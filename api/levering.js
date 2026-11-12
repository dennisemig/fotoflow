// Offentlig: henter en leverings- eller godkendelsesside ud fra dens token.
//   GET /api/levering?token=<uuid>            (levering_token)
//   GET /api/levering?token=<uuid>&preview=1  (preview_token, godkendelseslink)
// Returnerer kun de felter siden viser, plus signerede links til billederne.
import { sbRest, signerFiler } from './_lib/supabase-server.js'

// Tokens laves med crypto.randomUUID(); tillad kun sikre tegn, så værdien kan indgå i forespørgslen
const TOKEN = /^[A-Za-z0-9_-]{8,100}$/

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  res.setHeader('Cache-Control', 'no-store')

  const token = String(req.query?.token || '')
  const preview = req.query?.preview === '1'
  if (!TOKEN.test(token)) return res.status(404).json({ error: 'Ugyldigt link' })

  const tokenFelt = preview ? 'preview_token' : 'levering_token'
  const udloebFelt = preview ? 'preview_udloeber' : 'levering_udloeber'

  try {
    const sager = await sbRest(`sager?select=id,adresse,dato,${udloebFelt}&${tokenFelt}=eq.${token}&limit=1`)
    const sag = sager?.[0]
    if (!sag) return res.status(404).json({ error: 'Linket findes ikke' })

    const udloeber = sag[udloebFelt]
    if (udloeber && new Date(udloeber) < new Date()) {
      return res.status(410).json({ error: 'Linket er udløbet' })
    }

    const uploads = await sbRest(`uploads?select=id,filnavn,bruger_tag,dropbox_path&sag_id=eq.${sag.id}&order=bruger_tag.asc`)
    const links = await signerFiler((uploads || []).map(u => u.dropbox_path).filter(Boolean), 7 * 24 * 60 * 60)
    const billeder = (uploads || [])
      .filter(u => links[u.dropbox_path])
      .map(u => ({ id: u.id, filnavn: u.filnavn, bruger_tag: u.bruger_tag, url: links[u.dropbox_path] }))

    res.status(200).json({ sag: { adresse: sag.adresse, dato: sag.dato, udloeber }, billeder })
  } catch (e) {
    console.error('Levering fejl:', e)
    res.status(500).json({ error: 'Kunne ikke hente leveringen' })
  }
}
