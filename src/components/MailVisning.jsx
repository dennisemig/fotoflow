import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { laesMail, sendMail, hentVedhaeftning, tilknyt, fjernFraSag, hentLinks } from '../lib/mail'
import { matchMails, mailNoegle } from '../lib/mailMatch'
import { signaturHtml } from '../../api/_lib/signatur.js'

export const fmtDato = d => {
  if (!d) return ''
  const dt = new Date(d)
  const idag = new Date()
  if (dt.toDateString() === idag.toDateString()) return dt.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
  const sammeÅr = dt.getFullYear() === idag.getFullYear()
  return dt.toLocaleDateString('da-DK', { day: 'numeric', month: 'short', ...(sammeÅr ? {} : { year: 'numeric' }) })
}
export const navnAf = a => a?.navn || a?.email || ''
const fmtStr = b => b > 1024 * 1024 ? `${(b * 0.74 / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b * 0.74 / 1024))} KB`

// Farver til citerede (ældre) mails i en tråd: skifter mellem to farver for hvert niveau
const CITAT_FARVER = [
  { bg: '#e2ecf5', kant: '#5b84a8' },
  { bg: '#f2f4f6', kant: '#a7b0b9' },
]

// Outlook citerer ikke med <blockquote>, men indsætter en "Fra:/From:"-blok før den gamle mail.
// Den blok og alt efter den pakkes ind i <blockquote>, så alle tråde ser ens ud.
function pakOutlookCitater(doc) {
  const markører = [...doc.querySelectorAll('#divRplyFwdMsg, div[id^="divRplyFwdMsg"], div[style*="border-top"]')]
    .filter(el => el.id?.startsWith('divRplyFwdMsg') || /^\s*(fra|from|sendt|sent)\s*:/i.test(el.textContent || ''))
    .filter(el => !el.closest('blockquote'))
  for (const m of markører.reverse()) {
    // Outlook lægger ofte markøren i en ekstra <div> – start fra det øverste element under body/forælderen
    let start = m
    while (start.parentElement && start.parentElement !== doc.body && !start.previousElementSibling && start.parentElement.tagName === 'DIV') start = start.parentElement
    const forælder = start.parentElement
    if (!forælder) continue
    const bq = doc.createElement('blockquote')
    let n = start
    while (n) { const næste = n.nextSibling; bq.appendChild(n); n = næste }
    forælder.appendChild(bq)
  }
}

function htmlDokument(html) {
  let krop = html
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    pakOutlookCitater(doc)
    krop = doc.body.innerHTML
  } catch {}
  const niveauer = Array.from({ length: 8 }, (_, i) => {
    const f = CITAT_FARVER[i % 2]
    return `${Array(i + 1).fill('blockquote').join(' ')}{background:${f.bg}!important;border-left:3px solid ${f.kant}!important}`
  }).join('\n')
  // Scripts er slået fra af sandbox; links åbner i ny fane
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#222;margin:0;padding:4px;word-wrap:break-word}img{max-width:100%;height:auto}table{max-width:100%}
blockquote{margin:12px 0 4px!important;padding:10px 14px!important;border-radius:8px}
${niveauer}</style>
</head><body>${krop}</body></html>`
}

// Ren tekst: linjer med ">" grupperes efter citatniveau og farves som i html
function TekstMedCitater({ tekst }) {
  const blokke = []
  for (const linje of (tekst || '(ingen tekst)').split('\n')) {
    const m = linje.match(/^((?:\s*>)+)\s?/)
    const niveau = m ? (m[1].match(/>/g) || []).length : 0
    const indhold = m ? linje.slice(m[0].length) : linje
    const sidste = blokke[blokke.length - 1]
    if (sidste && sidste.niveau === niveau) sidste.linjer.push(indhold)
    else blokke.push({ niveau, linjer: [indhold] })
  }
  return (
    <div style={{ fontSize: 14, padding: 12, background: 'var(--surf)', border: '.5px solid var(--brd)', borderRadius: 8 }}>
      {blokke.map((b, i) => {
        const f = b.niveau ? CITAT_FARVER[(b.niveau - 1) % 2] : null
        return (
          <pre key={i} style={{
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', margin: f ? `6px 0 6px ${Math.min(b.niveau - 1, 4) * 12}px` : 0,
            ...(f ? { background: f.bg, borderLeft: `3px solid ${f.kant}`, padding: '8px 12px', borderRadius: 8 } : {})
          }}>{b.linjer.join('\n')}</pre>
        )
      })}
    </div>
  )
}

// Mailens tekst – fra tekstdelen, ellers trukket ud af html
function rentTekst(mail) {
  if (mail.tekst?.trim()) return mail.tekst
  try {
    const doc = new DOMParser().parseFromString((mail.html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h\d)>/gi, '\n'), 'text/html')
    return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim()
  } catch { return '' }
}

function citatIntro(mail) {
  const dato = mail.dato ? new Date(mail.dato).toLocaleString('da-DK', { dateStyle: 'long', timeStyle: 'short' }) : ''
  return `Den ${dato} skrev ${navnAf(mail.fra)} <${mail.fra?.email}>:`
}

/**
 * Viser én mail med svar og tilknytning til sager.
 * mail:   header fra listen ({ mappe, uid, messageId, ... })
 * sager:  sager der kan vælges ved tilknytning (id, adresse, ...)
 * sagId:  hvis visningen står på en sag (svar tilknyttes sagen, og mailen kan fjernes fra den)
 */
export default function MailVisning({ mail, sager = [], sagId, minAdresse, onLuk, onAendret, toast = () => {} }) {
  const navigate = useNavigate()
  const [fuld, setFuld] = useState(null)
  const [fejl, setFejl] = useState(null)
  const [links, setLinks] = useState([])
  const [svar, setSvar] = useState(null) // { til, cc, emne, tekst }
  const [sender, setSender] = useState(false)
  const [vælgSag, setVælgSag] = useState(false)
  const [sagSøg, setSagSøg] = useState('')

  useEffect(() => {
    setFuld(null); setFejl(null); setSvar(null); setVælgSag(false)
    laesMail(mail.mappe, mail.uid).then(setFuld).catch(e => setFejl(e.message))
    if (mail.messageId) hentLinks({ messageIds: [mail.messageId] }).then(setLinks)
    else setLinks([])
  }, [mail.mappe, mail.uid])

  const m = fuld || mail
  // Bred skærm: sagen åbnes i delt visning på Sager-siden, ellers på egen side
  const åbnSag = id => navigate(window.innerWidth < 1100 ? `/sager/${id}` : `/sager?sag=${id}`)
  const forslag = (fuld && sager.length)
    ? (matchMails([{ ...fuld, tekst: fuld.tekst || (fuld.html || '').replace(/<[^>]+>/g, ' ') }], sager, links, { minAdresse }).get(mailNoegle(fuld)) || [])
    : []
  const tilknyttedeIds = new Set(links.filter(l => !l.skjult).map(l => l.sag_id))
  const sagNavn = id => sager.find(s => s.id === id)?.adresse || links.find(l => l.sag_id === id)?.emne || 'Sag'

  function startSvar(alle) {
    const mig = (minAdresse || '').toLowerCase()
    const fraMig = m.fra?.email === mig
    const til = fraMig ? m.til.map(a => a.email) : [m.fra.email]
    const cc = alle ? [...m.til, ...m.cc].map(a => a.email).filter(e => e && e !== mig && !til.includes(e)) : []
    const emne = /^(re|sv)\s*:/i.test(m.emne) ? m.emne : `Re: ${m.emne}`
    setSvar({ til: til.join(', '), cc: cc.join(', '), emne, tekst: '', citatIntro: citatIntro(m), citatTekst: rentTekst(m) })
  }

  function videresend() {
    setSvar({
      til: '', cc: '', emne: `Fwd: ${m.emne}`, tekst: '', videresend: true,
      citatIntro: `---------- Videresendt mail ----------\nFra: ${navnAf(m.fra)} <${m.fra?.email}>\nDato: ${new Date(m.dato).toLocaleString('da-DK')}\nEmne: ${m.emne}`,
      citatTekst: rentTekst(m)
    })
  }

  async function send() {
    setSender(true)
    try {
      const r = await sendMail({
        til: svar.til, cc: svar.cc, emne: svar.emne, tekst: svar.tekst, citatIntro: svar.citatIntro, citatTekst: svar.citatTekst,
        inReplyTo: svar.videresend ? undefined : m.messageId,
        references: svar.videresend ? undefined : [...(m.references || []), m.messageId].filter(Boolean)
      })
      // Svaret hører til de samme sager som mailen (og sagen vi står på)
      const sagIds = new Set([...tilknyttedeIds, ...(sagId ? [sagId] : []), ...forslag.filter(f => f.styrke === 'sikker').map(f => f.sagId)])
      for (const id of sagIds) await tilknyt({ messageId: r.messageId, mappe: r.sendtMappe, uid: null, emne: svar.emne, fra: { navn: 'Mig' }, dato: new Date().toISOString() }, id).catch(() => {})
      toast(r.sendtMappe ? '✓ Sendt og gemt i Sendt post' : '✓ Sendt')
      setSvar(null)
      onAendret?.()
    } catch (e) {
      toast(`Kunne ikke sende: ${e.message}`)
    }
    setSender(false)
  }

  async function knyt(id) {
    try {
      await tilknyt(m, id)
      setLinks(await hentLinks({ messageIds: [m.messageId] }))
      setVælgSag(false); setSagSøg('')
      toast('✓ Mailen er tilknyttet sagen')
      onAendret?.()
    } catch (e) { toast(e.message) }
  }

  async function fjern(id) {
    try {
      await fjernFraSag(m, id)
      setLinks(await hentLinks({ messageIds: [m.messageId] }))
      toast('Mailen vises ikke længere på sagen')
      onAendret?.()
    } catch (e) { toast(e.message) }
  }

  const L = { fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em' }
  const chip = { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg)', border: '.5px solid var(--brd)', borderRadius: 20, padding: '3px 10px', fontSize: 12 }
  const sikreForslag = forslag.filter(f => !tilknyttedeIds.has(f.sagId))
  const søgte = sagSøg.trim()
    ? sager.filter(s => (s.adresse || '').toLowerCase().includes(sagSøg.trim().toLowerCase())).slice(0, 8)
    : sager.slice(0, 8)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--pr)', wordBreak: 'break-word' }}>{m.emne}</div>
        {onLuk && <button className="btn btn-outline btn-sm" onClick={onLuk} style={{ flexShrink: 0 }}>✕ Luk</button>}
      </div>

      <div style={{ fontSize: 13, lineHeight: 1.6 }}>
        <div><b>{navnAf(m.fra)}</b> <span style={{ color: 'var(--muted)' }}>&lt;{m.fra?.email}&gt;</span></div>
        <div style={{ color: 'var(--muted)' }}>Til: {(m.til || []).map(navnAf).join(', ') || '—'}{m.cc?.length ? ` · Cc: ${m.cc.map(navnAf).join(', ')}` : ''}</div>
        <div style={{ color: 'var(--muted)' }}>{m.dato ? new Date(m.dato).toLocaleString('da-DK', { dateStyle: 'full', timeStyle: 'short' }) : ''}</div>
      </div>

      {/* Sager */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <span style={L}>Sag:</span>
        {[...tilknyttedeIds].map(id => (
          <span key={id} style={{ ...chip, borderColor: 'var(--pr)' }}>
            <span style={{ cursor: 'pointer', color: 'var(--pr)', fontWeight: 600 }} onClick={() => åbnSag(id)}>📋 {sagNavn(id)}</span>
            <span title="Fjern fra sagen" style={{ cursor: 'pointer', color: 'var(--muted)' }} onClick={() => fjern(id)}>✕</span>
          </span>
        ))}
        {sikreForslag.map(f => (
          <span key={f.sagId} style={{ ...chip, borderStyle: f.styrke === 'sikker' ? 'solid' : 'dashed' }} title={f.grund}>
            <span style={{ cursor: 'pointer' }} onClick={() => åbnSag(f.sagId)}>{f.styrke === 'sikker' ? '📋' : '❔'} {sagNavn(f.sagId)}</span>
            {f.sagId === sagId
              ? <span title="Fjern fra sagen" style={{ cursor: 'pointer', color: 'var(--muted)' }} onClick={() => fjern(f.sagId)}>✕</span>
              : <span title="Tilknyt fast" style={{ cursor: 'pointer', color: 'var(--grn)', fontWeight: 700 }} onClick={() => knyt(f.sagId)}>✓</span>}
          </span>
        ))}
        {!tilknyttedeIds.size && !sikreForslag.length && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Ingen sag fundet</span>}
        {m.messageId && <button className="btn btn-outline btn-sm" onClick={() => setVælgSag(v => !v)}>+ Tilknyt sag</button>}
      </div>
      {sikreForslag.some(f => f.styrke !== 'sikker') && (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: -6 }}>❔ = mulig sag (mægleren har flere aktive sager). Tryk ✓ for at vælge den rigtige.</div>
      )}

      {vælgSag && (
        <div style={{ border: '.5px solid var(--brd)', borderRadius: 10, padding: 10, background: 'var(--bg)' }}>
          <input autoFocus placeholder="Søg adresse..." value={sagSøg} onChange={e => setSagSøg(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--brd)', borderRadius: 8, fontSize: 13, marginBottom: 8, fontFamily: 'inherit' }} />
          {søgte.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ingen sager fundet</div>}
          {søgte.map(s => (
            <div key={s.id} onClick={() => knyt(s.id)} style={{ padding: '7px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 13, display: 'flex', justifyContent: 'space-between', gap: 8 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surf)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span>{s.adresse}</span>
              <span style={{ color: 'var(--muted)', fontSize: 12, flexShrink: 0 }}>{s.dato ? new Date(s.dato + 'T12:00:00').toLocaleDateString('da-DK') : ''}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-sm" onClick={() => startSvar(false)} disabled={!fuld}>↩ Svar</button>
        <button className="btn btn-outline btn-sm" onClick={() => startSvar(true)} disabled={!fuld}>↩↩ Svar alle</button>
        <button className="btn btn-outline btn-sm" onClick={videresend} disabled={!fuld}>→ Videresend</button>
      </div>

      {svar && (
        <div className="card" style={{ border: '2px solid var(--pr)', padding: 14 }}>
          <div className="form-group" style={{ marginBottom: 8 }}><label>Til</label><input value={svar.til} onChange={e => setSvar(s => ({ ...s, til: e.target.value }))} placeholder="navn@firma.dk" /></div>
          <div className="form-group" style={{ marginBottom: 8 }}><label>Cc</label><input value={svar.cc} onChange={e => setSvar(s => ({ ...s, cc: e.target.value }))} /></div>
          <div className="form-group" style={{ marginBottom: 8 }}><label>Emne</label><input value={svar.emne} onChange={e => setSvar(s => ({ ...s, emne: e.target.value }))} /></div>
          <textarea autoFocus value={svar.tekst} onChange={e => setSvar(s => ({ ...s, tekst: e.target.value }))}
            placeholder="Skriv din besked..."
            style={{ width: '100%', minHeight: 160, padding: 10, border: '1px solid var(--brd)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
          {/* Signaturen sættes på af serveren – her vises den bare */}
          <div style={{ padding: '4px 10px 0', transform: 'scale(.9)', transformOrigin: 'left top' }} dangerouslySetInnerHTML={{ __html: signaturHtml({ appUrl: window.location.origin }) }} />
          {svar.citatTekst && (
            <details style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>
              <summary style={{ cursor: 'pointer' }}>{svar.videresend ? 'Den videresendte mail kommer med' : 'Den tidligere mail citeres nedenunder'}</summary>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: '6px 0 0', padding: '8px 12px', borderLeft: '3px solid var(--brd)', maxHeight: 200, overflow: 'auto' }}>{svar.citatIntro}{'\n'}{svar.citatTekst}</pre>
            </details>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-green" onClick={send} disabled={sender || !svar.til.trim() || !(svar.tekst.trim() || svar.citatTekst)}>{sender ? 'Sender...' : '✉ Send'}</button>
            <button className="btn btn-outline" onClick={() => setSvar(null)}>Annuller</button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>Sendes fra {minAdresse || 'din mail'} og gemmes i Sendt post.</div>
        </div>
      )}

      {fejl && <div className="warn-box">⚠ {fejl}</div>}
      {!fuld && !fejl && <div style={{ color: 'var(--muted)', fontSize: 13, padding: 20, textAlign: 'center' }}>Henter mail...</div>}

      {fuld?.vedhaeftninger?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {fuld.vedhaeftninger.map(v => (
            <button key={v.part} className="btn btn-outline btn-sm" disabled={!v.kanHentes}
              title={v.kanHentes ? 'Hent fil' : 'For stor til at hente her – åbn i Roundcube'}
              onClick={() => hentVedhaeftning(m.mappe, m.uid, v).catch(e => toast(e.message))}>
              📎 {v.filnavn} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>({fmtStr(v.stoerrelse)})</span>
            </button>
          ))}
        </div>
      )}

      {fuld && (fuld.html
        ? <iframe title="Mail" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={htmlDokument(fuld.html)}
            style={{ width: '100%', height: '65vh', border: '.5px solid var(--brd)', borderRadius: 8, background: '#fff' }} />
        : <TekstMedCitater tekst={fuld.tekst} />)}
    </div>
  )
}
