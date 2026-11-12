import crypto from 'node:crypto'
import { sbRest } from './_lib/supabase-server.js'
import { kraevLogin } from './_lib/auth.js'

// Kalender-abonnement (iCal). Kræver et hemmeligt token i linket:
//   /api/kalender-feed?token=<hemmeligt>
// Tokenet er KALENDER_TOKEN fra Vercel, eller afledt af service key hvis den ikke er sat.
// Det fulde link kan hentes af en logget ind bruger med /api/kalender-feed?link=1.
function feedToken() {
  if (process.env.KALENDER_TOKEN) return process.env.KALENDER_TOKEN
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!key) return null
  return crypto.createHmac('sha256', key).update('fotoflow-kalender-feed').digest('hex').slice(0, 32)
}

function sammeToken(a, b) {
  const ba = Buffer.from(String(a)), bb = Buffer.from(String(b))
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb)
}

export default async function handler(req, res) {
  const forventet = feedToken()
  if (!forventet) return res.status(500).send('Kalender-feed er ikke konfigureret')

  if (req.query?.link === '1') {
    const user = await kraevLogin(req, res)
    if (!user) return
    const APP_URL = process.env.VITE_APP_URL || 'https://app.vaniagraphics.dk'
    return res.status(200).json({ url: `${APP_URL}/api/kalender-feed?token=${forventet}` })
  }

  if (!sammeToken(req.query?.token || '', forventet)) {
    return res.status(401).send('Ugyldigt eller manglende token')
  }

  let sager
  try {
    sager = await sbRest('sager?select=id,adresse,dato,tidspunkt,tidspunkt_slut,status,type,maegler_navn,maegler_firma,noter&status=neq.afsluttet&order=dato.asc')
  } catch (e) {
    console.error('Kalender-feed fejl:', e)
    return res.status(500).send('Kunne ikke hente sager')
  }

  // Generer iCal indhold
  const now = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'

  const events = sager.map(s => {
    const dato = s.dato // YYYY-MM-DD
    if (!dato) return ''

    // Tidspunkt
    let dtStart, dtEnd
    if (s.tidspunkt) {
      const start = s.tidspunkt.slice(0, 5).replace(':', '')
      const slut = s.tidspunkt_slut ? s.tidspunkt_slut.slice(0, 5).replace(':', '') : null
      const datoKompakt = dato.replace(/-/g, '')
      dtStart = `${datoKompakt}T${start}00`
      dtEnd = slut ? `${datoKompakt}T${slut}00` : `${datoKompakt}T${start}00`
    } else {
      // Heldagsbegivenhed
      dtStart = dato.replace(/-/g, '')
      dtEnd = dato.replace(/-/g, '')
    }

    const tidFormat = s.tidspunkt ? 'TZID=Europe/Copenhagen:' : 'VALUE=DATE:'
    const uid = `fotoflow-${s.id}@vaniagraphics.dk`
    const summary = s.adresse || 'Fotografering'
    const description = [
      s.maegler_navn ? `Mægler: ${s.maegler_navn}` : '',
      s.maegler_firma ? `Firma: ${s.maegler_firma}` : '',
      s.type ? `Type: ${s.type}` : '',
      s.noter ? `Noter: ${s.noter}` : '',
    ].filter(Boolean).join('\\n')

    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;${tidFormat}${dtStart}`,
      `DTEND;${tidFormat}${dtEnd}`,
      `SUMMARY:📷 ${summary}`,
      description ? `DESCRIPTION:${description}` : '',
      `LOCATION:${summary}`,
      `STATUS:${s.status === 'afsluttet' ? 'CANCELLED' : 'CONFIRMED'}`,
      'END:VEVENT'
    ].filter(Boolean).join('\r\n')
  }).filter(Boolean).join('\r\n')

  const ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//VaniaGraphics//FotoFlow//DA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:VaniaGraphics – Sager',
    'X-WR-TIMEZONE:Europe/Copenhagen',
    'X-WR-CALDESC:Fotosager fra FotoFlow',
    events,
    'END:VCALENDAR'
  ].join('\r\n')

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="vaniagraphics.ics"')
  res.setHeader('Cache-Control', 'no-cache, no-store')
  res.status(200).send(ical)
}
