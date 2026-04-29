import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast, ToastContainer } from '../hooks/useToast'

export default function Freelancere() {
  const [freelancere, setFreelancere] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const { toasts, toast } = useToast()

  useEffect(() => { fetch() }, [])

  async function fetch() {
    const { data, error } = await supabase.from('freelancere').select('*').order('navn')
    if (error) console.error('Freelancere fejl:', error)
    setFreelancere(data || [])
    setLoading(false)
  }

  const filtered = freelancere.filter(f =>
    (f.navn || '').toLowerCase().includes(search.toLowerCase()) ||
    (f.email || '').toLowerCase().includes(search.toLowerCase())
  )

  const colors = ['#3A4A5A', '#4a5a6a', '#5a6a7a', '#2e5040', '#40302e', '#3a3a5a']
  const initials = n => n?.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase() || 'FL'

  return (
    <div>
      <ToastContainer toasts={toasts} />
      <div className="page-title">Freelancere</div>
      <div className="toolbar">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Søg freelancere..." />
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ Tilføj freelancer</button>
      </div>
      {loading ? <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Indlæser...</div>
        : filtered.length === 0 ? <div className="card"><div className="empty-state"><div className="empty-icon">📷</div>Ingen freelancere endnu – klik "+ Tilføj freelancer"</div></div>
        : <div className="grid2">
          {filtered.map((f, i) => (
            <div key={f.id} onClick={() => navigate(`/freelancere/${f.id}`)}
              style={{ background: 'var(--surf)', borderRadius: 'var(--rad)', border: '.5px solid var(--brd)', padding: 16, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--pr)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--brd)'}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: colors[i % colors.length], color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>
                {initials(f.navn)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{f.navn}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{f.email || 'Ingen email'}</div>
                <div style={{ marginTop: 5 }}>{(f.specialer || []).map(s => <span key={s} className="tag">{s}</span>)}</div>
              </div>
              <span className={`badge ${f.aktiv !== false ? 'badge-active' : 'badge-new'}`}>{f.aktiv !== false ? 'Aktiv' : 'Inaktiv'}</span>
            </div>
          ))}
        </div>
      }
      {showModal && <TilfoejModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetch(); toast('✓ Freelancer tilføjet!') }} toast={toast} />}
    </div>
  )
}

function TilfoejModal({ onClose, onSaved, toast }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ navn: '', email: '', telefon: '', specialer: '' })
  const [perms, setPerms] = useState({ kan_uploade: true, kan_se_sagsdetaljer: true, kan_se_alle_sager: false, kan_redigere_sager: false, kan_se_crm: false })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSend() {
    if (!form.navn || !form.email) { toast('Udfyld navn og email', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('freelancere').insert([{
      navn: form.navn,
      email: form.email,
      telefon: form.telefon || null,
      specialer: form.specialer ? form.specialer.split(',').map(s => s.trim()).filter(Boolean) : [],
      aktiv: true,
      kan_uploade: perms.kan_uploade,
      kan_se_sagsdetaljer: perms.kan_se_sagsdetaljer,
      kan_se_alle_sager: perms.kan_se_alle_sager,
      kan_redigere_sager: perms.kan_redigere_sager,
      kan_se_crm: perms.kan_se_crm,
      invited_at: new Date().toISOString()
    }])
    if (error) { toast('Fejl: ' + error.message, 'error'); setSaving(false); return }
    await fetch('/api/send-notification', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'freelancer_invitation', mægler: { email: form.email, navn: form.navn } })
    }).catch(() => {})
    setSaving(false); onSaved()
  }

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">Tilføj freelancer<button className="modal-close" onClick={onClose}>✕</button></div>
        <div style={{ display: 'flex', marginBottom: 20, borderRadius: 8, overflow: 'hidden', border: '.5px solid var(--brd)' }}>
          {['Info', 'Adgang', 'Gem'].map((s, i) => (
            <div key={s} style={{ flex: 1, padding: '7px 4px', textAlign: 'center', fontSize: 12, fontWeight: 600, borderRight: i < 2 ? '.5px solid var(--brd)' : 'none', background: i + 1 < step ? 'var(--grn-bg)' : i + 1 === step ? 'var(--pr)' : '#f7f7f7', color: i + 1 < step ? 'var(--grn)' : i + 1 === step ? '#fff' : 'var(--muted)' }}>
              {i + 1 < step ? '✓ ' : ''}{s}
            </div>
          ))}
        </div>
        {step === 1 && <>
          <div className="form-group"><label>Fulde navn *</label><input value={form.navn} onChange={e => set('navn', e.target.value)} placeholder="f.eks. Lars Pedersen" autoFocus /></div>
          <div className="form-group"><label>Email *</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="lars@foto.dk" /></div>
          <div className="form-group"><label>Telefon</label><input value={form.telefon} onChange={e => set('telefon', e.target.value)} placeholder="+45 xx xx xx xx" /></div>
          <div className="form-group"><label>Specialer (kommasepareret)</label><input value={form.specialer} onChange={e => set('specialer', e.target.value)} placeholder="Portræt, Event, Bryllup..." /></div>
        </>}
        {step === 2 && <>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>Vælg hvad {form.navn} må se og gøre:</div>
          {[
            { key: 'kan_uploade', lbl: 'Upload råfiler', sub: 'Kan uploade til tildelte sager' },
            { key: 'kan_se_sagsdetaljer', lbl: 'Se sagsdetaljer', sub: 'Adresse, kunde, tidspunkt' },
            { key: 'kan_se_alle_sager', lbl: 'Se alle sager', sub: 'Ikke kun egne sager' },
            { key: 'kan_redigere_sager', lbl: 'Redigere sager', sub: 'Ændre status og noter' },
            { key: 'kan_se_crm', lbl: 'CRM-adgang', sub: 'Kan se kundeoplysninger' },
          ].map(r => (
            <div key={r.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '.5px solid var(--brd)' }}>
              <div><div style={{ fontWeight: 500, fontSize: 13 }}>{r.lbl}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.sub}</div></div>
              <label className="toggle"><input type="checkbox" checked={!!perms[r.key]} onChange={e => setPerms(p => ({ ...p, [r.key]: e.target.checked }))} /><span className="tslider"></span></label>
            </div>
          ))}
        </>}
        {step === 3 && <>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>Klar til at tilføje {form.navn}:</div>
          <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 16, border: '.5px solid var(--brd)', marginBottom: 14 }}>
            <div style={{ fontSize: 13, marginBottom: 4 }}><b>Navn:</b> {form.navn}</div>
            <div style={{ fontSize: 13, marginBottom: 4 }}><b>Email:</b> {form.email}</div>
            {form.telefon && <div style={{ fontSize: 13, marginBottom: 4 }}><b>Telefon:</b> {form.telefon}</div>}
            {form.specialer && <div style={{ fontSize: 13 }}><b>Specialer:</b> {form.specialer}</div>}
          </div>
          <div className="info-box">📧 En invitationsmail sendes til {form.email}</div>
        </>}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
          <button className="btn btn-outline btn-sm" style={{ visibility: step > 1 ? 'visible' : 'hidden' }} onClick={() => setStep(s => s - 1)}>← Tilbage</button>
          {step < 3
            ? <button className="btn btn-primary btn-sm" onClick={() => setStep(s => s + 1)}>Næste →</button>
            : <button className="btn btn-green btn-sm" onClick={handleSend} disabled={saving}>{saving ? 'Gemmer...' : '✓ Tilføj freelancer'}</button>
          }
        </div>
      </div>
    </div>
  )
}
