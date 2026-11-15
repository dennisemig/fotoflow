import { supabase } from './supabase'

// Mæglere (medarbejdere) pr. kunde – tabellen kunde_maeglere (se supabase-maeglere.sql).
// Email gemmes altid med små bogstaver, så samme mægler ikke kommer på to gange.

export const normEmail = e => (e || '').trim().toLowerCase() || null

export async function hentMaeglere(kundeId) {
  if (!kundeId) return []
  const { data, error } = await supabase.from('kunde_maeglere').select('*').eq('kunde_id', kundeId).order('navn')
  if (error) { console.error('kunde_maeglere:', error.message); return [] }
  return data || []
}

export async function gemMaegler(kundeId, { id, navn, email, telefon }) {
  const række = { kunde_id: kundeId, navn: (navn || '').trim(), email: normEmail(email), telefon: (telefon || '').trim() || null }
  if (!række.navn) return { error: { message: 'Navn mangler' } }
  return id
    ? supabase.from('kunde_maeglere').update(række).eq('id', id).select().single()
    : supabase.from('kunde_maeglere').insert(række).select().single()
}

export async function sletMaegler(id) {
  return supabase.from('kunde_maeglere').delete().eq('id', id)
}

// Tilføjer mægleren til kundens liste, hvis emailen ikke allerede står der.
// Fejler stille (fx hvis tabellen ikke er oprettet endnu), så booking-flowet ikke stopper.
export async function tilfoejMaeglerHvisNy(kundeId, { navn, email, telefon }) {
  const mail = normEmail(email)
  if (!kundeId || !mail) return
  const { error } = await supabase.from('kunde_maeglere').upsert(
    { kunde_id: kundeId, navn: (navn || '').trim() || mail, email: mail, telefon: telefon || null },
    { onConflict: 'kunde_id,email', ignoreDuplicates: true }
  )
  if (error) console.error('Kunne ikke tilføje mægler:', error.message)
}

// Finder kunden ud fra mæglerens email (hvis mægleren står på en kundes liste).
export async function findKundeForMaeglerEmail(email) {
  const mail = normEmail(email)
  if (!mail) return null
  const { data } = await supabase.from('kunde_maeglere').select('kunde_id').eq('email', mail).limit(2)
  // Kun et entydigt match – står mægleren hos flere kunder, gætter vi ikke
  return data?.length === 1 ? data[0].kunde_id : null
}
