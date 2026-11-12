// Offentlig: optagede tider til bookingsiden (/book/:slug).
// Returnerer kun dato og klokkeslæt, ingen adresser, mæglere eller noter.
import { sbRest } from './_lib/supabase-server.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const idag = new Date().toISOString().split('T')[0]
  try {
    const [sager, blokeringer] = await Promise.all([
      sbRest(`sager?select=dato,tidspunkt,tidspunkt_slut,freelancer_id&dato=gte.${idag}&status=neq.afsluttet`),
      sbRest(`kalender_blokeringer?select=dato,tidspunkt,tidspunkt_slut&dato=gte.${idag}`)
    ])
    const optagede = [
      // Sager med freelancer blokerer ikke Dennis' egen kalender
      ...(sager || []).filter(s => !s.freelancer_id).map(s => ({ dato: s.dato, tidspunkt: s.tidspunkt, tidspunkt_slut: s.tidspunkt_slut })),
      ...(blokeringer || []).map(b => ({ dato: b.dato, tidspunkt: b.tidspunkt || '00:00', tidspunkt_slut: b.tidspunkt_slut || '23:59' }))
    ]
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ optagede })
  } catch (e) {
    console.error('Optagede tider fejl:', e)
    res.status(500).json({ error: 'Kunne ikke hente ledige tider' })
  }
}
