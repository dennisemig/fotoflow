export default async function handler(req, res) {
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY

  // Hent sager fra Supabase
  const r = await fetch(`${SUPABASE_URL}/rest/v1/sager?select=id,adresse,dato,tidspunkt,tidspunkt_slut,status,type,maegler_navn,maegler_firma,noter&status=neq.afsluttet&order=dato.asc`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  })
  const sager = await r.json()

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
