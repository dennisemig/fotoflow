import { supabase } from './supabase'
import { soegeordForSag, matchMails, mailNoegle } from './mailMatch'

// Kald til /api/mail med brugerens login
async function kald(action, { query = {}, body } = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const qs = new URLSearchParams({ action, ...Object.fromEntries(Object.entries(query).filter(([, v]) => v != null && v !== '')) })
  const r = await fetch(`/api/mail?${qs}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(d.error || `Fejl ${r.status}`), { ikkeOpsat: d.ikkeOpsat })
  return d
}

export const hentMapper = () => kald('mapper')
export const hentUlaeste = () => kald('ulaeste')
// Sendes når mails er læst/hentet, så tallet i menuen opdateres med det samme
export const meldMailsAendret = () => window.dispatchEvent(new Event('fotoflow-mails'))
export const hentListe = ({ mappe, side, q }) => kald('liste', { query: { mappe, side, q } })
export const laesMail = (mappe, uid) => kald('laes', { query: { mappe, uid } })
export const soegMails = kriterier => kald('soeg', { body: kriterier })
export const sendMail = data => kald('send', { body: data })

export async function hentVedhaeftning(mappe, uid, v) {
  const { data: { session } } = await supabase.auth.getSession()
  const qs = new URLSearchParams({ action: 'vedhaeftning', mappe, uid, part: v.part })
  const r = await fetch(`/api/mail?${qs}`, { headers: { Authorization: `Bearer ${session?.access_token}` } })
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || `Fejl ${r.status}`) }
  const blob = await r.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = v.filnavn; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

// ---------- Tilknytninger (tabellen mail_tilknytninger) ----------

export async function hentLinks({ sagId, messageIds } = {}) {
  let q = supabase.from('mail_tilknytninger').select('*')
  if (sagId) q = q.eq('sag_id', sagId)
  if (messageIds) { if (!messageIds.length) return []; q = q.in('message_id', messageIds) }
  const { data, error } = await q
  if (error) { console.error('mail_tilknytninger:', error.message); return [] }
  return data || []
}

const linkRække = (mail, sagId, skjult) => ({
  sag_id: sagId, message_id: mail.messageId, mappe: mail.mappe, uid: mail.uid,
  emne: mail.emne, fra: mail.fra?.navn || mail.fra?.email || null, dato: mail.dato || null, skjult
})

export async function tilknyt(mail, sagId) {
  if (!mail.messageId) throw new Error('Mailen har intet Message-ID og kan ikke tilknyttes')
  const { error } = await supabase.from('mail_tilknytninger').upsert(linkRække(mail, sagId, false), { onConflict: 'sag_id,message_id' })
  if (error) throw new Error(error.message)
}

// Skjuler en mail fra en sag (også selvom den matches automatisk)
export async function fjernFraSag(mail, sagId) {
  if (!mail.messageId) return
  const { error } = await supabase.from('mail_tilknytninger').upsert(linkRække(mail, sagId, true), { onConflict: 'sag_id,message_id' })
  if (error) throw new Error(error.message)
}

// Sager, som mails kan kobles til, med de felter matchingen bruger:
// sager fra de sidste `dage` dage (og uden dato), plus alle sager for bestemte mæglere
const SAG_FELTER = 'id, adresse, status, dato, maegler_email, maegler_navn, maegler_sagsnummer, kunde_id'
export async function hentSagerTilMatch({ dage = 120, maeglerEmails = [] } = {}) {
  const fra = new Date(Date.now() - dage * 864e5).toISOString().slice(0, 10)
  const kald = [supabase.from('sager').select(SAG_FELTER).or(`dato.gte.${fra},dato.is.null`).order('dato', { ascending: false }).limit(1000)]
  const emails = maeglerEmails.filter(Boolean)
  if (emails.length) kald.push(supabase.from('sager').select(SAG_FELTER).in('maegler_email', emails).limit(1000))
  const svar = await Promise.all(kald)
  const byId = new Map()
  for (const { data } of svar) for (const s of data || []) byId.set(s.id, s)
  return [...byId.values()]
}

// Alle mails for én sag: søger på mæglerens email, adressen, sagsnummeret og manuelt
// tilknyttede mails, og sorterer dem i "sikre" og "mulige" (mægleren har flere sager).
export async function mailsForSag(sag) {
  const [links, sager] = await Promise.all([hentLinks({ sagId: sag.id }), hentSagerTilMatch({ dage: 400, maeglerEmails: [sag.maegler_email, (sag.maegler_email || '').toLowerCase()] })])
  const { emails, tekster } = soegeordForSag(sag)
  const manuelleIds = links.filter(l => !l.skjult).map(l => l.message_id)
  const { mails, minAdresse } = await soegMails({ emails, tekster, messageIds: manuelleIds })
  // Hent også tilknytninger til andre sager for de fundne mails (så en mail, der er
  // tilknyttet en anden sag manuelt, ikke vises som "mulig" her)
  const alleLinks = await hentLinks({ messageIds: [...new Set(mails.map(m => m.messageId).filter(Boolean))] })
  const sagerMedSag = sager.some(s => s.id === sag.id) ? sager.map(s => s.id === sag.id ? { ...s, ...sag } : s) : [...sager, sag]
  const match = matchMails(mails, sagerMedSag, [...links, ...alleLinks.filter(l => l.sag_id !== sag.id)], { minAdresse })
  const sikre = [], mulige = []
  const set = new Set()
  for (const m of mails) {
    const k = mailNoegle(m)
    if (set.has(k)) continue // samme mail i flere mapper
    const r = (match.get(k) || []).find(x => x.sagId === sag.id)
    if (!r) continue
    set.add(k)
    const andreSikre = (match.get(k) || []).some(x => x.sagId !== sag.id && x.styrke === 'sikker')
    if (r.styrke === 'sikker') sikre.push({ ...m, grund: r.grund })
    else if (!andreSikre) mulige.push({ ...m, grund: r.grund })
  }
  return { sikre, mulige, minAdresse }
}
