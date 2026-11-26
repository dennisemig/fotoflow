import { useEffect, useState } from 'react'
import { mailsForSag, hentSagerTilMatch, tilknyt } from '../lib/mail'
import MailVisning, { fmtDato, navnAf } from './MailVisning'
import NyMail from './NyMail'

// Mails på en sag: dem der sikkert hører til (mægler med én aktiv sag, adresse i emne/tekst,
// samme tråd, manuelt tilknyttet) og dem fra mægleren, der måske handler om en anden af dennes sager.
export default function SagMails({ sag, toast }) {
  const [res, setRes] = useState(null)
  const [fejl, setFejl] = useState(null)
  const [visMulige, setVisMulige] = useState(false)
  const [åben, setÅben] = useState(null)
  const [sager, setSager] = useState([])
  const [antalVist, setAntalVist] = useState(5)
  const [nyMail, setNyMail] = useState(false)

  async function hent() {
    setFejl(null)
    try { setRes(await mailsForSag(sag)) } catch (e) { setFejl(e) }
  }

  useEffect(() => { setRes(null); hent() }, [sag.id, sag.maegler_email, sag.adresse, sag.maegler_sagsnummer])
  useEffect(() => { if (åben && !sager.length) hentSagerTilMatch({ dage: 400, maeglerEmails: [sag.maegler_email] }).then(setSager) }, [åben])

  if (fejl?.ikkeOpsat) return null // mail ikke sat op i Vercel endnu – vis ikke kortet

  async function knytHurtigt(e, m) {
    e.stopPropagation()
    try { await tilknyt(m, sag.id); toast?.('✓ Mailen er tilknyttet sagen'); hent() } catch (err) { toast?.(err.message) }
  }

  const række = (m, mulig) => (
    <div key={`${m.mappe}:${m.uid}`} onClick={() => setÅben(m)}
      style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', border: '.5px solid var(--brd)', marginBottom: 6, background: m.laest ? 'var(--surf)' : 'var(--bg)' }}
      title={m.grund}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: 'var(--muted)' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {m.fra?.email === res?.minAdresse ? `Til: ${(m.til || []).map(navnAf).join(', ')}` : navnAf(m.fra)}
        </span>
        <span style={{ flexShrink: 0 }}>{m.vedhaeftning ? '📎 ' : ''}{fmtDato(m.dato)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: m.laest ? 400 : 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.emne}</div>
        {mulig && m.messageId && <button className="btn btn-outline btn-sm" style={{ flexShrink: 0 }} onClick={e => knytHurtigt(e, m)}>✓ Hører til</button>}
      </div>
    </div>
  )

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="section-hd" style={{ margin: 0 }}>✉ Mails {res ? `(${res.sikre.length})` : ''}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-outline btn-sm" onClick={() => setNyMail(true)}>✉ Ny mail</button>
          <button className="btn btn-outline btn-sm" onClick={() => { setRes(null); hent() }} title="Opdatér">⟳</button>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        {!res && !fejl && <div style={{ fontSize: 13, color: 'var(--muted)' }}>Søger i mails...</div>}
        {fejl && <div className="warn-box">⚠ {fejl.message}</div>}
        {res && res.sikre.length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>Ingen mails fundet til sagen.</div>}
        {res && res.sikre.slice(0, antalVist).map(m => række(m, false))}
        {res && res.sikre.length > antalVist && (
          <button className="btn btn-outline btn-sm" onClick={() => setAntalVist(n => n + 10)}>Vis flere ({res.sikre.length - antalVist})</button>
        )}
        {res && res.mulige.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div onClick={() => setVisMulige(v => !v)} style={{ fontSize: 12, color: 'var(--muted)', cursor: 'pointer', marginBottom: 6 }}>
              {visMulige ? '▾' : '▸'} {res.mulige.length} mail{res.mulige.length > 1 ? 's' : ''} fra mægleren, der måske handler om en anden sag
            </div>
            {visMulige && res.mulige.slice(0, 20).map(m => række(m, true))}
          </div>
        )}
      </div>

      {nyMail && (
        <NyMail sagId={sag.id} forvalg={{ til: sag.maegler_email || '', emne: (sag.adresse || '').split(',')[0] }}
          onLuk={() => setNyMail(false)} onSendt={hent} toast={toast} />
      )}

      {åben && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setÅben(null)}>
          <div className="modal" style={{ width: 860 }}>
            <MailVisning mail={åben} sagId={sag.id} sager={[sag, ...sager.filter(s => s.id !== sag.id)]} minAdresse={res?.minAdresse}
              onLuk={() => setÅben(null)} onAendret={hent} toast={toast} />
          </div>
        </div>
      )}
    </div>
  )
}
