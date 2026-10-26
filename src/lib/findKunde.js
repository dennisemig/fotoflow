import { supabase } from './supabase'

// Ord der ikke siger noget om hvilken kunde det er
const FYLDORD = new Set(['aps', 'as', 'a/s', 'ivs', 'is', 'i/s', 'v', 'ved', 'og', 'the', 'af'])

function tokens(tekst) {
  return (tekst || '')
    .toLowerCase()
    .replace(/a\/s|i\/s/g, ' ')
    .split(/[^a-z0-9æøåäöü]+/)
    .filter(t => t && !FYLDORD.has(t))
}

// Finder den kunde der passer til mæglerfirmaet ud fra navnet.
// Returnerer kun et id hvis der er ét entydigt match.
export function matchKundeNavn(firma, kunder) {
  const firmaTokens = tokens(firma)
  if (firmaTokens.length === 0) return null

  const kandidater = []
  for (const k of kunder) {
    const kundeTokens = tokens(k.navn)
    if (kundeTokens.length === 0) continue
    const kundeSet = new Set(kundeTokens)
    const firmaSet = new Set(firmaTokens)
    const firmaIKunde = firmaTokens.every(t => kundeSet.has(t))
    const kundeIFirma = kundeTokens.every(t => firmaSet.has(t))
    if (firmaIKunde || kundeIFirma) kandidater.push({ id: k.id, præcis: firmaIKunde && kundeIFirma })
  }
  // Præcis samme navn vinder, ellers skal der være præcis én kandidat
  const præcise = kandidater.filter(k => k.præcis)
  if (præcise.length === 1) return præcise[0].id
  if (kandidater.length === 1) return kandidater[0].id
  return null
}

// Finder kunde til en booking/sag:
// 1) samme mægler-email er tidligere knyttet til en kunde på en sag
// 2) kundens email er mæglerens email
// 3) mæglerfirma matcher kundens navn entydigt
export async function findKundeId({ maegler_email, maegler_firma }, kunder) {
  const email = (maegler_email || '').trim()
  if (email) {
    const { data: tidligere } = await supabase
      .from('sager')
      .select('kunde_id')
      .ilike('maegler_email', email)
      .not('kunde_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
    if (tidligere?.[0]?.kunde_id) return tidligere[0].kunde_id
  }

  if (!kunder) {
    const { data } = await supabase.from('kunder').select('id, navn, email')
    kunder = data || []
  }

  if (email) {
    const emailMatch = kunder.filter(k => (k.email || '').trim().toLowerCase() === email.toLowerCase())
    if (emailMatch.length === 1) return emailMatch[0].id
  }

  return matchKundeNavn(maegler_firma, kunder)
}
