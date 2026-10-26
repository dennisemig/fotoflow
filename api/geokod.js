// Adresse → koordinater for kørselsberegningen.
// Kører på serveren, fordi browseren kan blive blokeret af de offentlige kortservere (CORS / for mange kald).
// Fundne adresser caches i Vercels CDN, så hver adresse kun slås op én gang.
const UA = 'FotoFlow/1.0 (app.vaniagraphics.dk; dennis@vaniagraphics.dk)'

// "Vej 12, 1. tv, 2750 Ballerup" → "Vej 12, 2750 Ballerup" (etage/dør kender OSM ikke)
function udenEtage(adresse) {
  const m = adresse.match(/^(.*?\d+\s?[A-Za-zÆØÅæøå]?)\b.*?(\d{4})\s+(.+)$/)
  return m ? `${m[1]}, ${m[2]} ${m[3]}` : null
}

const vent = ms => new Promise(r => setTimeout(r, ms))

async function nominatim(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=dk&limit=1&q=${encodeURIComponent(q)}`
  const headers = { 'User-Agent': UA, 'Accept-Language': 'da' }
  let r = await fetch(url, { headers })
  // Mange opslag i træk giver 429 (for mange kald): vent og prøv én gang til
  if (r.status === 429 || r.status >= 500) { await vent(1500); r = await fetch(url, { headers }) }
  if (!r.ok) throw new Error(`Nominatim ${r.status}`)
  const d = await r.json()
  return d.length > 0 ? { lng: parseFloat(d[0].lon), lat: parseFloat(d[0].lat), kilde: 'nominatim' } : null
}

async function photon(q) {
  const r = await fetch(`https://photon.komoot.io/api/?limit=1&bbox=7.9,54.5,15.3,57.8&q=${encodeURIComponent(q)}`, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`Photon ${r.status}`)
  const d = await r.json()
  const c = d.features?.[0]?.geometry?.coordinates
  return c ? { lng: c[0], lat: c[1], kilde: 'photon' } : null
}

export default async function handler(req, res) {
  const q = String(req.query.q || '').trim()
  if (q.length < 3) return res.status(400).json({ error: 'Mangler adresse' })
  const fejl = []
  const forsoeg = [q, udenEtage(q)].filter((x, i, a) => x && a.indexOf(x) === i)
  for (const tekst of forsoeg) {
    for (const opslag of [nominatim, photon]) {
      try {
        const res2 = await opslag(tekst)
        if (res2) {
          res.setHeader('Cache-Control', 'public, s-maxage=31536000, stale-while-revalidate=86400')
          return res.status(200).json(res2)
        }
      } catch (e) { fejl.push(e.message) }
    }
  }
  res.setHeader('Cache-Control', 'no-store')
  // 404 = ikke fundet, 502 = en kortserver svarede ikke, så svaret er ikke sikkert (browseren prøver igen)
  return res.status(fejl.length > 0 ? 502 : 404).json({ error: 'Ikke fundet', fejl })
}
