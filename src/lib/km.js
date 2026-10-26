import { supabase } from './supabase'

async function getKoordinater(adresse) {
  try {
    const r = await fetch(`https://api.dataforsyningen.dk/adresser?q=${encodeURIComponent(adresse)}&per_side=1&struktur=mini`)
    const d = await r.json()
    if (d.length > 0) return { lng: d[0].x, lat: d[0].y }
  } catch (e) {}
  return null
}

// Km (enkelt vej) fra fraAdresse til tilAdresse, eller null hvis det ikke kan beregnes
export async function beregnKm(fraAdresse, tilAdresse) {
  if (!fraAdresse || !tilAdresse) return null
  try {
    const [fra, til] = await Promise.all([getKoordinater(fraAdresse), getKoordinater(tilAdresse)])
    if (!fra || !til) return null
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${fra.lng},${fra.lat};${til.lng},${til.lat}?overview=false`)
    const d = await r.json()
    if (d.code === 'Ok' && d.routes.length > 0) {
      return Math.round(d.routes[0].distance / 1000 * 10) / 10
    }
  } catch (e) {}
  return null
}

// Startadressen fra den indloggede brugers profil (Indstillinger)
export async function hentStartadresse() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('startadresse').eq('id', user.id).single()
  return data?.startadresse || null
}

// Beregner km for en sag og gemmer det. Fejler stille, så det aldrig blokerer oprettelse.
export async function gemKmForSag(sagId, adresse, startadresse) {
  try {
    const start = startadresse || await hentStartadresse()
    const km = await beregnKm(start, adresse)
    if (km != null) await supabase.from('sager').update({ km_distance: km }).eq('id', sagId)
    return km
  } catch (e) {
    return null
  }
}
