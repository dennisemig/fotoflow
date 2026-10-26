import { supabase } from './supabase'

// DAWA (api.dataforsyningen.dk) lukkede 1. oktober 2026, så adresser slås op i OpenStreetMap.
// Nominatim tillader max 1 kald i sekundet, så kaldene køres efter hinanden med pause.
// Koordinater gemmes også i browseren, så hver adresse kun slås op én gang
const CACHE_KEY = 'fotoflow_koordinater'
const koordinatCache = new Map(Object.entries((() => { try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {} } catch (e) { return {} } })()))
function gemCache() {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(koordinatCache))) } catch (e) {}
}
let naesteKald = Promise.resolve()

function iKoe(fn) {
  const kald = naesteKald.then(fn)
  naesteKald = kald.catch(() => {}).then(() => new Promise(r => setTimeout(r, 1100)))
  return kald
}

async function nominatim(q) {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=dk&limit=1&q=${encodeURIComponent(q)}`)
  const d = await r.json()
  if (d.length > 0) return { lng: parseFloat(d[0].lon), lat: parseFloat(d[0].lat) }
  return null
}

async function photon(q) {
  const r = await fetch(`https://photon.komoot.io/api/?limit=1&bbox=7.9,54.5,15.3,57.8&q=${encodeURIComponent(q)}`)
  const d = await r.json()
  const c = d.features?.[0]?.geometry?.coordinates
  if (c) return { lng: c[0], lat: c[1] }
  return null
}

// "Vej 12, 1. tv, 2750 Ballerup" → "Vej 12, 2750 Ballerup" (etage/dør kender OSM ikke)
function udenEtage(adresse) {
  const m = adresse.match(/^(.*?\d+\s?[A-Za-zÆØÅæøå]?)\b.*?(\d{4})\s+(.+)$/)
  return m ? `${m[1]}, ${m[2]} ${m[3]}` : null
}

async function getKoordinater(adresse) {
  const noegle = adresse.trim().toLowerCase()
  if (koordinatCache.has(noegle)) return koordinatCache.get(noegle)
  const forsoeg = [adresse, udenEtage(adresse)].filter((q, i, a) => q && a.indexOf(q) === i)
  let res = null
  for (const q of forsoeg) {
    try { res = await iKoe(() => nominatim(q)) } catch (e) {}
    if (res) break
    try { res = await photon(q) } catch (e) {}
    if (res) break
  }
  if (res) { koordinatCache.set(noegle, res); gemCache() }
  return res
}

// Km (enkelt vej) fra fraAdresse til tilAdresse, eller null hvis det ikke kan beregnes
export async function beregnKm(fraAdresse, tilAdresse) {
  if (!fraAdresse || !tilAdresse) return null
  try {
    const fra = await getKoordinater(fraAdresse)
    const til = await getKoordinater(tilAdresse)
    if (!fra || !til) return null
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${fra.lng},${fra.lat};${til.lng},${til.lat}?overview=false`)
    const d = await r.json()
    if (d.code === 'Ok' && d.routes.length > 0) {
      return Math.round(d.routes[0].distance / 1000 * 10) / 10
    }
  } catch (e) {}
  return null
}

// OSRM's offentlige server afviser for mange kald i træk, så rutekald køres med pause og ét genforsøg
let naesteRute = Promise.resolve()
function iRuteKoe(fn) {
  const kald = naesteRute.then(fn)
  naesteRute = kald.catch(() => {}).then(() => new Promise(r => setTimeout(r, 1000)))
  return kald
}

async function osrmRute(punkter) {
  for (let forsoeg = 0; forsoeg < 2; forsoeg++) {
    try {
      const r = await iRuteKoe(() => fetch(`https://router.project-osrm.org/route/v1/driving/${punkter.join(';')}?overview=false`))
      const d = await r.json()
      if (d.code === 'Ok' && d.routes.length > 0) return d.routes[0].legs.map(l => Math.round(l.distance / 1000 * 10) / 10)
    } catch (e) {}
    await new Promise(r => setTimeout(r, 2000))
  }
  return null
}

const RUTE_KEY = 'fotoflow_ruter'
function hentRuteCache() { try { return JSON.parse(localStorage.getItem(RUTE_KEY)) || {} } catch (e) { return {} } }

// Rute hjem → stop 1 → stop 2 → … → hjem.
// Stop der ikke kan findes på kortet springes over (med[i] = false).
// Returnerer { med, ben } hvor ben er km for hvert ben mellem de medtagne stop, eller null.
export async function beregnRute(startadresse, stop) {
  const noegle = [startadresse, ...stop].join('|').toLowerCase()
  const cache = hentRuteCache()
  if (cache[noegle]) return cache[noegle]
  const hjem = await getKoordinater(startadresse)
  if (!hjem) return null
  const med = []
  const punkter = [`${hjem.lng},${hjem.lat}`]
  for (const a of stop) {
    const k = await getKoordinater(a)
    med.push(!!k)
    if (k) punkter.push(`${k.lng},${k.lat}`)
  }
  if (punkter.length === 1) return null
  punkter.push(`${hjem.lng},${hjem.lat}`)
  const ben = await osrmRute(punkter)
  if (!ben) return null
  const res = { med, ben }
  try { localStorage.setItem(RUTE_KEY, JSON.stringify({ ...hentRuteCache(), [noegle]: res })) } catch (e) {}
  return res
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
