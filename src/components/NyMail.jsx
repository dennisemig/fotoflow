import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { sendMail, tilknyt } from '../lib/mail'
import { signaturHtml } from '../../api/_lib/signatur.js'

/**
 * Skriv en ny mail (ikke et svar). Vises som dialog.
 * forvalg: { til, emne, tekst }  – fx mæglerens email og adressen, når den åbnes fra en sag
 * sagId:   mailen tilknyttes sagen, når den er sendt
 */
export default function NyMail({ forvalg = {}, sagId, onLuk, onSendt, toast = () => {} }) {
  const [form, setForm] = useState({ til: forvalg.til || '', cc: '', emne: forvalg.emne || '', tekst: forvalg.tekst || '' })
  const [sender, setSender] = useState(false)
  const [adresser, setAdresser] = useState([])
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Mæglere og kunder som forslag i "Til"
  useEffect(() => {
    Promise.all([
      supabase.from('kunde_maeglere').select('navn, email').not('email', 'is', null),
      supabase.from('kunder').select('navn, email').not('email', 'is', null),
    ]).then(([m, k]) => {
      const set = new Map()
      for (const r of [...(m.data || []), ...(k.data || [])]) if (r.email) set.set(r.email.toLowerCase(), r.navn)
      setAdresser([...set].map(([email, navn]) => ({ email, navn })))
    })
  }, [])

  async function send() {
    setSender(true)
    try {
      const r = await sendMail({ til: form.til, cc: form.cc, emne: form.emne, tekst: form.tekst })
      if (sagId) await tilknyt({ messageId: r.messageId, mappe: r.sendtMappe, uid: null, emne: form.emne, fra: { navn: 'Mig' }, dato: new Date().toISOString() }, sagId).catch(() => {})
      toast(r.sendtMappe ? '✓ Sendt og gemt i Sendt post' : '✓ Sendt')
      onSendt?.()
      onLuk()
    } catch (e) {
      toast(`Kunne ikke sende: ${e.message}`)
    }
    setSender(false)
  }

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && !sender && onLuk()}>
      <div className="modal" style={{ width: 680 }}>
        <div className="modal-title">Ny mail<button className="modal-close" onClick={onLuk}>✕</button></div>
        <datalist id="mail-adresser">
          {adresser.map(a => <option key={a.email} value={a.email}>{a.navn}</option>)}
        </datalist>
        <div className="form-group" style={{ marginBottom: 8 }}><label>Til</label><input autoFocus={!form.til} list="mail-adresser" value={form.til} onChange={e => set('til', e.target.value)} placeholder="navn@firma.dk (flere adskilles med komma)" /></div>
        <div className="form-group" style={{ marginBottom: 8 }}><label>Cc</label><input list="mail-adresser" value={form.cc} onChange={e => set('cc', e.target.value)} /></div>
        <div className="form-group" style={{ marginBottom: 8 }}><label>Emne</label><input value={form.emne} onChange={e => set('emne', e.target.value)} /></div>
        <textarea autoFocus={!!form.til} value={form.tekst} onChange={e => set('tekst', e.target.value)} placeholder="Skriv din besked..."
          style={{ width: '100%', minHeight: 200, padding: 10, border: '1px solid var(--brd)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
        <div style={{ padding: '4px 10px 0', transform: 'scale(.9)', transformOrigin: 'left top' }} dangerouslySetInnerHTML={{ __html: signaturHtml({ appUrl: window.location.origin }) }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn btn-green" onClick={send} disabled={sender || !form.til.trim() || !form.tekst.trim()}>{sender ? 'Sender...' : '✉ Send'}</button>
          <button className="btn btn-outline" onClick={onLuk} disabled={sender}>Annuller</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>Sendes fra din mail med signatur og gemmes i Sendt post.</div>
      </div>
    </div>
  )
}
