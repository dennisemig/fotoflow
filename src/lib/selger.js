import { supabase } from './supabase'

// Sager fra bookinger hvor "VANIA kontakter sælger" er valgt.
// Felterne kopieres fra bookingen når den godkendes (Bookinger.jsx godkend()).
// En sag står på kontaktlisten indtil der er sat dato, eller sælger er markeret som kontaktet.

export const selgerFelter = 'kontakt_selger, selger_navn, selger_telefon, selger_kontaktet_at'

// Ingen dato endnu, og sagen kom fra en booking hvor vi skal kontakte sælger
export const venterPaaSelger = s => !!s?.kontakt_selger && !s?.dato

// Står på kontaktlisten: venter på sælger og er ikke markeret som kontaktet
export const skalKontaktes = s => venterPaaSelger(s) && !s?.selger_kontaktet_at

// Kort label til lister: "Kontakt sælger" før opkaldet, "Afventer sælger" efter
export const selgerLabel = s => skalKontaktes(s) ? 'Ingen dato – kontakt sælger' : 'Ingen dato – afventer sælger'

export async function hentKontaktliste() {
  const { data, error } = await supabase
    .from('sager')
    .select(`id, adresse, created_at, maegler_navn, maegler_firma, ${selgerFelter}`)
    .eq('kontakt_selger', true)
    .is('dato', null)
    .is('selger_kontaktet_at', null)
    .order('created_at', { ascending: true })
  if (error) { console.error('Kontaktliste fejl:', error); return [] }
  return data || []
}

// kontaktet = true markerer sælger som kontaktet (fjernes fra listen), false sætter sagen tilbage på listen
export async function markerSelgerKontaktet(sagId, kontaktet = true) {
  const selger_kontaktet_at = kontaktet ? new Date().toISOString() : null
  const { error } = await supabase.from('sager').update({ selger_kontaktet_at }).eq('id', sagId)
  if (error) throw error
  return selger_kontaktet_at
}
