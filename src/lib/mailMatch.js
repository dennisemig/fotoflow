// Kobler mails til sager. Ren logik uden netværk, så den kan testes og bruges både i
// indbakken og på sagen.
//
// Signaler, stærkest først:
//   1. Manuel tilknytning (tabellen mail_tilknytninger)
//   2. Samme mailtråd (In-Reply-To/References eller samme emne) som en mail, der allerede hører til sagen
//   3. Adressen eller mæglerens sagsnummer står i emnet (eller i teksten, når mailen er åbnet)
//   4. Mailen er fra/til sagens mægler. Har mægleren kun én aktiv sag, er det den.
//      Har mægleren flere, er den kun "mulig" – medmindre en anden af mæglerens sager nævnes.

const STAERK = 'sikker'
const MULIG = 'mulig'

// En sag er "aktiv" for en mail, hvis mailen er sendt fra AKTIV_FØR dage før fotodatoen
// til AKTIV_EFTER dage efter (mæglere skriver ofte efter levering)
const AKTIV_FØR = 45
const AKTIV_EFTER = 60

export const normEmail = e => (e || '').trim().toLowerCase()

export function normEmne(s) {
  let t = (s || '').toLowerCase().trim()
  // Fjern Re:/Sv:/Fw:/Fwd:/VS:/Videresend: gentagne gange
  for (let i = 0; i < 5; i++) t = t.replace(/^\s*(re|sv|aw|fw|fwd|vs|videresend|videresendt)\s*(\[\d+\])?\s*:\s*/i, '')
  return t.replace(/\s+/g, ' ').trim()
}

// Sammensatte gadenavne deles, så "Kongensgade" og "Kongens Gade" ser ens ud
const GADE_ENDELSER = ['boulevard', 'stræde', 'straede', 'vænge', 'vaenge', 'plads', 'parken', 'haven', 'bakke', 'gade', 'vej', 'alle', 'torv', 'park', 'have', 'sti', 'høj', 'vang', 'toft']

function delGadeord(w) {
  for (const e of GADE_ENDELSER) {
    if (w.length >= e.length + 3 && w.endsWith(e)) return [w.slice(0, -e.length), e]
  }
  return [w]
}

function ord(tekst) {
  return (tekst || '').toLowerCase()
    .normalize('NFC').replace(/é/g, 'e')
    .replace(/[^a-z0-9æøåäöü]+/g, ' ')
    .split(' ').filter(Boolean)
    .flatMap(delGadeord)
}

// "Store Kongens Gade 44, 2. th, 1264 København K" → { gade: ['store','kongens','gade'], nr: '44' }
export function adresseDele(adresse) {
  const første = String(adresse || '').split(',')[0]
  const m = første.match(/^(.*?)(\d+\s*[a-zA-Z]?)\b/)
  if (!m) return null
  const gade = ord(m[1])
  const nr = m[2].replace(/\s+/g, '').toLowerCase()
  if (!gade.length || !nr) return null
  return { gade, nr }
}

// Er tw en forkortelse af sw? "kgs" ~ "kongens", "st" ~ "store", "gl" ~ "gammel"
function forkortelse(tw, sw) {
  if (tw === sw) return true
  if (!tw || !sw || tw[0] !== sw[0] || tw.length < 2 || tw.length >= sw.length) return false
  let j = 0
  for (const c of sw) if (c === tw[j]) j++
  return j === tw.length
}

// Matcher ordene lige før husnummeret mod gadenavnets ord, med forkortelser
// ("st kgs gade" ~ "store kongens gade"). Første ord (fx "store", "gammel") må mangle.
function gadeMatcher(tekstOrd, gade) {
  if (tekstOrd.length >= gade.length) {
    const vindue = tekstOrd.slice(tekstOrd.length - gade.length)
    if (vindue.every((tw, i) => forkortelse(tw, gade[i]))) return true
  }
  if (gade.length >= 3) return gadeMatcher(tekstOrd, gade.slice(1))
  return false
}

// Står adressen i teksten? Kræver husnummer + gadenavn lige før det.
export function naevnerAdresse(tekst, adresse) {
  const d = adresseDele(adresse)
  if (!d) return false
  const w = ord(tekst)
  // husnumre som "44b" kan stå som "44 b"
  for (let i = 0; i < w.length; i++) {
    let nr = w[i]
    if (/^\d+$/.test(nr) && /^[a-z]$/.test(w[i + 1] || '') && d.nr === nr + w[i + 1]) nr = d.nr
    if (nr !== d.nr) continue
    const før = w.slice(Math.max(0, i - d.gade.length), i)
    if (gadeMatcher(før, d.gade)) return true
  }
  return false
}

export function naevnerSagsnummer(tekst, nr) {
  const n = String(nr || '').trim()
  if (n.length < 4) return false
  return new RegExp(`(^|[^0-9a-z])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^0-9a-z]|$)`, 'i').test(tekst || '')
}

export function erAktiv(sag, dato = new Date()) {
  if (!sag.dato) return sag.status !== 'afsluttet'
  const dage = (new Date(dato) - new Date(sag.dato + 'T12:00:00')) / 864e5
  return dage >= -AKTIV_FØR && dage <= AKTIV_EFTER
}

// Alle mailadresser i mailen, undtagen min egen
export function deltagere(mail, minAdresse) {
  const mig = normEmail(minAdresse)
  return [mail.fra, ...(mail.til || []), ...(mail.cc || [])]
    .map(a => normEmail(a?.email)).filter(e => e && e !== mig)
}

function sagNaevnt(tekst, sag) {
  return naevnerAdresse(tekst, sag.adresse) || naevnerSagsnummer(tekst, sag.maegler_sagsnummer)
}

/**
 * Finder sager for en liste mails.
 * mails:    [{ messageId, inReplyTo, references, fra, til, cc, emne, tekst? }]
 * sager:    [{ id, adresse, status, dato, maegler_email, maegler_sagsnummer }]
 * links:    [{ message_id, sag_id, skjult }]
 * Returnerer Map messageId|uid-nøgle → [{ sagId, styrke, grund }] (stærkeste først)
 */
export function matchMails(mails, sager, links = [], { minAdresse = '', idag = new Date() } = {}) {
  const nøgle = m => m.messageId || `${m.mappe}:${m.uid}`
  const sagerById = new Map(sager.map(s => [s.id, s]))
  const prMaeglerAlle = new Map()
  for (const s of sager) {
    const e = normEmail(s.maegler_email)
    if (!e) continue
    if (!prMaeglerAlle.has(e)) prMaeglerAlle.set(e, [])
    prMaeglerAlle.get(e).push(s)
  }
  // Mæglerens sager, der var aktive da mailen blev sendt
  const maeglerSager = (e, m) => (prMaeglerAlle.get(e) || []).filter(s => erAktiv(s, m.dato || idag))
  const manuelle = new Map() // messageId → Set(sagId)
  const skjulte = new Set() // `${messageId}|${sagId}`
  for (const l of links) {
    if (l.skjult) { skjulte.add(`${l.message_id}|${l.sag_id}`); continue }
    if (!manuelle.has(l.message_id)) manuelle.set(l.message_id, new Set())
    manuelle.get(l.message_id).add(l.sag_id)
  }

  const res = new Map()
  const tilføj = (m, sagId, styrke, grund) => {
    if (!sagerById.has(sagId) || (m.messageId && skjulte.has(`${m.messageId}|${sagId}`))) return
    const k = nøgle(m)
    const liste = res.get(k) || []
    const findes = liste.find(x => x.sagId === sagId)
    if (findes) { if (findes.styrke !== STAERK && styrke === STAERK) Object.assign(findes, { styrke, grund }); return }
    liste.push({ sagId, styrke, grund })
    res.set(k, liste)
  }

  // Runde 1: manuelle, adresse/sagsnummer i emne/tekst, mægler
  for (const m of mails) {
    for (const sagId of manuelle.get(m.messageId) || []) tilføj(m, sagId, STAERK, 'Tilknyttet manuelt')
    const tekst = `${m.emne || ''}\n${m.tekst || ''}`
    const nævnte = sager.filter(s => sagNaevnt(tekst, s))
    for (const s of nævnte) tilføj(m, s.id, STAERK, naevnerAdresse(m.emne, s.adresse) ? 'Adressen står i emnet' : naevnerAdresse(tekst, s.adresse) ? 'Adressen står i mailen' : 'Sagsnummeret står i mailen')

    for (const e of deltagere(m, minAdresse)) {
      const ms = maeglerSager(e, m)
      if (!ms.length) continue
      // Nævner mailen en af mæglerens sager, er det dén – de andre springes over
      if (nævnte.some(s => ms.includes(s))) continue
      if (ms.length === 1) tilføj(m, ms[0].id, STAERK, 'Mæglerens eneste aktive sag')
      else for (const s of ms) tilføj(m, s.id, MULIG, `Fra mægleren, som har ${ms.length} aktive sager`)
    }
  }

  // Runde 2: tråde. En mail i samme tråd som en sikker mail hører til samme sag.
  const sikreIds = new Map() // messageId → Set(sagId)
  const sikreEmner = new Map() // normaliseret emne → Set(sagId)
  for (const m of mails) {
    for (const r of res.get(nøgle(m)) || []) {
      if (r.styrke !== STAERK) continue
      if (m.messageId) { if (!sikreIds.has(m.messageId)) sikreIds.set(m.messageId, new Set()); sikreIds.get(m.messageId).add(r.sagId) }
      const em = normEmne(m.emne)
      if (em.length >= 8) { if (!sikreEmner.has(em)) sikreEmner.set(em, new Set()); sikreEmner.get(em).add(r.sagId) }
    }
  }
  // Manuelt tilknyttede mails, som ikke selv er i listen, tæller også som trådstart
  for (const [id, ss] of manuelle) { if (!sikreIds.has(id)) sikreIds.set(id, new Set(ss)) }

  for (let runde = 0; runde < 3; runde++) {
    let ændret = false
    for (const m of mails) {
      const refs = [m.inReplyTo, ...(m.references || [])].filter(Boolean)
      const fundne = new Set()
      for (const r of refs) for (const s of sikreIds.get(r) || []) fundne.add(s)
      // Samme emne kun inden for samme personer (mægler) – ellers kan "Re: Billeder" ramme forkert
      const em = normEmne(m.emne)
      if (em.length >= 8) for (const s of sikreEmner.get(em) || []) {
        const sag = sagerById.get(s)
        if (deltagere(m, minAdresse).includes(normEmail(sag?.maegler_email)) || naevnerAdresse(m.emne, sag?.adresse)) fundne.add(s)
      }
      for (const s of fundne) {
        const før = (res.get(nøgle(m)) || []).find(x => x.sagId === s)?.styrke
        tilføj(m, s, STAERK, før === STAERK ? undefined : 'Samme mailtråd')
        if (før !== STAERK) {
          ændret = true
          if (m.messageId) { if (!sikreIds.has(m.messageId)) sikreIds.set(m.messageId, new Set()); sikreIds.get(m.messageId).add(s) }
        }
      }
      // Er mailen nu sikker på én sag, fjernes "mulig" på mæglerens andre sager
      const liste = res.get(nøgle(m))
      if (liste?.some(x => x.styrke === STAERK)) res.set(nøgle(m), liste.filter(x => x.styrke === STAERK))
    }
    if (!ændret) break
  }

  for (const [k, liste] of res) {
    liste.forEach(x => { if (!x.grund) x.grund = 'Samme mailtråd' })
    res.set(k, liste.sort((a, b) => (a.styrke === STAERK ? 0 : 1) - (b.styrke === STAERK ? 0 : 1)))
  }
  return res
}

export const mailNoegle = m => m.messageId || `${m.mappe}:${m.uid}`

// Søgeord til mailserveren for én sag: mægler-email, adressen som den står, og sagsnummeret
export function soegeordForSag(sag) {
  const d = adresseDele(sag.adresse)
  const første = String(sag.adresse || '').split(',')[0].trim()
  return {
    emails: [normEmail(sag.maegler_email)].filter(Boolean),
    tekster: [
      første,
      d ? `${d.gade[d.gade.length - 1]} ${d.nr}` : null, // fx "gade 44" fanger "Kgs gade 44"
      sag.maegler_sagsnummer
    ].filter(t => t && String(t).trim().length >= 4)
  }
}
