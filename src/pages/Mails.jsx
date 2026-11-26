import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useToast, ToastContainer } from '../hooks/useToast'
import { hentMapper, hentListe, hentLinks, hentSagerTilMatch } from '../lib/mail'
import { matchMails, mailNoegle, deltagere } from '../lib/mailMatch'
import MailVisning, { fmtDato, navnAf } from '../components/MailVisning'

const DELT_MIN_BREDDE = 1100

function mappeNavn(m) {
  if (m.sti === 'INBOX') return 'Indbakke'
  if (m.special === '\\Sent' || /sent$/i.test(m.sti)) return 'Sendt post'
  if (m.special === '\\Archive' || /arc?hive?$|arkiv$/i.test(m.sti)) return 'Arkiv'
  return m.navn
}
const SKJULTE = ['\\Junk', '\\Trash', '\\Drafts']
const synlig = m => !SKJULTE.includes(m.special) && !/(spam|junk|trash|papirkurv|drafts|kladder)$/i.test(m.sti)

export default function Mails() {
  const [params, setParams] = useSearchParams()
  const mappe = params.get('mappe') || 'INBOX'
  const side = Number(params.get('side') || 1)
  const q = params.get('q') || ''
  const [søgefelt, setSøgefelt] = useState(q)
  const [mapper, setMapper] = useState([])
  const [data, setData] = useState(null) // { mails, total, prSide, minAdresse }
  const [fejl, setFejl] = useState(null)
  const [henter, setHenter] = useState(true)
  const [sager, setSager] = useState([])
  const [links, setLinks] = useState([])
  const [valgt, setValgt] = useState(null)
  const [bred, setBred] = useState(() => window.innerWidth >= DELT_MIN_BREDDE)
  const { toasts, toast } = useToast()

  useEffect(() => {
    const f = () => setBred(window.innerWidth >= DELT_MIN_BREDDE)
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])

  useEffect(() => { hentMapper().then(d => setMapper(d.mapper.filter(synlig))).catch(() => {}) }, [])

  const hent = useCallback(async ({ stille = false } = {}) => {
    if (!stille) setHenter(true)
    setFejl(null)
    try {
      const d = await hentListe({ mappe, side, q })
      setData(d)
      // Sager til matching: de seneste måneder + alle sager for mæglerne i listen
      const emails = [...new Set(d.mails.flatMap(m => deltagere(m, d.minAdresse)))]
      const [s, l] = await Promise.all([
        hentSagerTilMatch({ dage: 180, maeglerEmails: emails }),
        hentLinks({ messageIds: d.mails.map(m => m.messageId).filter(Boolean) })
      ])
      setSager(s); setLinks(l)
    } catch (e) {
      setFejl(e)
    }
    setHenter(false)
  }, [mappe, side, q])

  useEffect(() => { hent() }, [hent])

  function sæt(nye) {
    setParams(p => {
      const ny = new URLSearchParams(p)
      for (const [k, v] of Object.entries(nye)) { if (v) ny.set(k, v); else ny.delete(k) }
      return ny
    })
    setValgt(null)
  }

  const mails = data?.mails || []
  const match = matchMails(mails, sager, links, { minAdresse: data?.minAdresse })
  const sagAf = id => sager.find(s => s.id === id)
  const sider = data ? Math.max(1, Math.ceil(data.total / data.prSide)) : 1
  const erSendt = /sent$/i.test(mappe) || mapper.find(m => m.sti === mappe)?.special === '\\Sent'

  function åbn(m) {
    setValgt(m)
    // Markér som læst i listen med det samme
    if (!m.laest) setData(d => ({ ...d, mails: d.mails.map(x => x.uid === m.uid ? { ...x, laest: true } : x) }))
  }

  if (fejl?.ikkeOpsat) return (
    <div>
      <div className="page-title">Mails</div>
      <div className="card" style={{ maxWidth: 640 }}>
        <div className="section-hd">Mail er ikke sat op endnu</div>
        <div style={{ fontSize: 13, lineHeight: 1.7 }}>
          Tilføj disse under <b>Vercel → Settings → Environment Variables</b> og deploy igen:
          <pre style={{ background: 'var(--bg)', padding: 12, borderRadius: 8, fontSize: 12, marginTop: 8 }}>{`MAIL_USER = dennis@vaniagraphics.dk
MAIL_PASS = (adgangskoden til mailen)
IMAP_HOST = cp17.nordicway.dk`}</pre>
        </div>
      </div>
    </div>
  )

  const liste = (
    <div style={{ minWidth: 0 }}>
      <div className="chip-raekke" style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {(mapper.length ? mapper : [{ sti: 'INBOX', navn: 'INBOX' }]).map(m => (
          <button key={m.sti} className={`btn btn-sm ${m.sti === mappe ? 'btn-primary' : 'btn-outline'}`} onClick={() => sæt({ mappe: m.sti === 'INBOX' ? '' : m.sti, side: '', q: '' })}>
            {mappeNavn(m)}
          </button>
        ))}
      </div>
      <form onSubmit={e => { e.preventDefault(); sæt({ q: søgefelt.trim(), side: '' }) }} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input value={søgefelt} onChange={e => setSøgefelt(e.target.value)} placeholder="Søg i afsender, emne og tekst..."
          style={{ flex: 1, minWidth: 0, padding: '8px 12px', border: '1px solid var(--brd)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }} />
        <button className="btn btn-outline btn-sm" type="submit">Søg</button>
        {q && <button className="btn btn-outline btn-sm" type="button" onClick={() => { setSøgefelt(''); sæt({ q: '', side: '' }) }}>✕</button>}
        <button className="btn btn-outline btn-sm" type="button" title="Opdatér" onClick={() => hent()}>⟳</button>
      </form>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {henter && !data && <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>Henter mails...</div>}
        {fejl && <div className="warn-box" style={{ margin: 12 }}>⚠ {fejl.message}</div>}
        {data && mails.length === 0 && <div className="empty-state"><div className="empty-icon">✉</div>{q ? 'Ingen mails matcher søgningen' : 'Ingen mails'}</div>}
        {mails.map(m => {
          const r = match.get(mailNoegle(m)) || []
          const sikker = r.filter(x => x.styrke === 'sikker')
          const mulig = r.filter(x => x.styrke !== 'sikker')
          const aktiv = valgt && valgt.uid === m.uid && valgt.mappe === m.mappe
          return (
            <div key={`${m.mappe}:${m.uid}`} onClick={() => åbn(m)}
              style={{ padding: '10px 14px', borderBottom: '.5px solid var(--brd)', cursor: 'pointer', background: aktiv ? 'var(--pr-light, #eef4f8)' : 'transparent', borderLeft: m.laest ? '3px solid transparent' : '3px solid var(--pr)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
                <span style={{ color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {erSendt ? `Til: ${(m.til || []).map(navnAf).join(', ')}` : navnAf(m.fra)}
                </span>
                <span style={{ color: 'var(--muted)', flexShrink: 0 }}>{m.vedhaeftning ? '📎 ' : ''}{m.besvaret ? '↩ ' : ''}{fmtDato(m.dato)}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: m.laest ? 400 : 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{m.emne}</div>
              {(sikker.length > 0 || mulig.length > 0) && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                  {sikker.map(x => (
                    <span key={x.sagId} title={x.grund} style={{ fontSize: 11, background: 'var(--grn-bg)', color: 'var(--grn)', borderRadius: 20, padding: '1px 8px' }}>📋 {sagAf(x.sagId)?.adresse?.split(',')[0]}</span>
                  ))}
                  {!sikker.length && mulig.length > 0 && (
                    <span title={mulig.map(x => sagAf(x.sagId)?.adresse).join('\n')} style={{ fontSize: 11, background: 'var(--gold-bg)', color: '#b45309', borderRadius: 20, padding: '1px 8px' }}>
                      ❔ {mulig.length} mulige sager
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {data && sider > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 10, fontSize: 13 }}>
          <button className="btn btn-outline btn-sm" disabled={side <= 1} onClick={() => sæt({ side: side - 1 > 1 ? String(side - 1) : '' })}>‹ Nyere</button>
          <span style={{ color: 'var(--muted)' }}>Side {side} af {sider} · {data.total} mails</span>
          <button className="btn btn-outline btn-sm" disabled={side >= sider} onClick={() => sæt({ side: String(side + 1) })}>Ældre ›</button>
        </div>
      )}
    </div>
  )

  const visning = valgt && (
    <div className="card" style={{ minWidth: 0 }}>
      <MailVisning key={`${valgt.mappe}:${valgt.uid}`} mail={valgt} sager={sager} minAdresse={data?.minAdresse}
        onLuk={() => setValgt(null)} onAendret={async () => {
          setLinks(await hentLinks({ messageIds: mails.map(m => m.messageId).filter(Boolean) }))
          hent({ stille: true })
        }} toast={toast} />
    </div>
  )

  return (
    <div>
      <ToastContainer toasts={toasts} />
      {!(valgt && !bred) && <div className="page-title">Mails</div>}
      {bred
        ? <div style={{ display: 'grid', gridTemplateColumns: valgt ? 'minmax(320px, 1fr) minmax(0, 1.4fr)' : '1fr', gap: 16, alignItems: 'start' }}>
            {liste}
            {valgt && <div style={{ position: 'sticky', top: 70 }}>{visning}</div>}
          </div>
        : (valgt ? visning : liste)}
    </div>
  )
}
