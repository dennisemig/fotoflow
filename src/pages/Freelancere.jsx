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
    const { data } = await supabase.from('profiles').select('*').eq('role', 'freelancer').order('full_name')
    setFreelancere(data || []); setLoading(false)
  }

  const filtered = freelancere.filter(f =>
    f.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    f.email?.toLowerCase().includes(search.toLowerCase())
  )

  const initials = n => n?.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase() || 'FL'
  const colors = ['#3A4A5A','#4a5a6a','#5a6a7a','#6a7a8a','#2e5040','#40302e']

  return (
    <div>
      <ToastContainer toasts={toasts} />
      <div className="page-title">Freelancere</div>
      <div className="toolbar">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Søg freelancere..." />
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ Tilføj freelancer</button>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>Indlæser...</div> : (
        <div className="grid2">
          {filtered.map((f, i) => (
            <div key={f.id} onClick={() => navigate(`/freelancere/${f.id}`)}
              style={{ background: 'var(--surf)', borderRadius: 'var(--rad)', border: '.5px solid var(--brd)', padding: 16, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', transition: 'border-color .15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--pr)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--brd)'}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: colors[i % colors.length], color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>
                {initials(f.full_name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{f.full_name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{f.email}</div>
                <div style={{ marginTop: 5 }}>{(f.specialer || []).map(s => <span key={s} className="tag">{s}</span>)}</div>
              </div>
              <span className="badge badge-active">Aktiv</span>
            </div>
          ))}
          {filtered.length === 0 && !loading && (
            <div style={{ gridColumn: '1/-1' }}>
              <div className="empty-state"><div className="empty-icon">📷</div>Ingen freelancere endnu – klik "+ Tilføj freelancer"</div>
            </div>
          )}
        </div>
      )}
      {showModal && <TilfoejFreelancerModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetch(); toast('✓ Invitation sendt!') }} toast={toast} />}
    </div>
  )
}

function TilfoejFreelancerModal({ onClose, onSaved, toast }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ full_name: '', email: '', telefon: '', specialer: '' })
  const [perms, setPerms] = useState({ upload: true, se_sag: true, se_alle: false, rediger: false, crm: false })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSend() {
    if (!form.full_name || !form.email) { toast('Udfyld navn og email', 'error'); return }
    setSaving(true)
    const { data: authData, error: authError } = await supabase.auth.admin?.inviteUserByEmail
      ? await supabase.auth.admin.inviteUserByEmail(form.email, { data: { full_name: form.full_name, role: 'freelancer' } })
      : { data: null, error: null }

    const specialerArr = form.specialer ? form.specialer.split(',').map(s => s.trim()).filter(Boolean) : []
    await supabase.from('profiles').upsert({
      email: form.email, full_name: form.full_name, telefon: form.telefon,
      role: 'freelancer', specialer: specialerArr, rettigheder: perms
    }, { onConflict: 'email' })

    await fetch('/api/send-notification', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'freelancer_invitation', mægler: { email: form.email, navn: form.full_name } })
    }).catch(() => {})

    setSaving(false)
    onSaved()
  }

  const steps = ['Info', 'Adgang', 'Inviter']

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">Tilføj freelancer<button className="modal-close" onClick={onClose}>✕</button></div>

        {/* STEP INDICATOR */}
        <div style={{ display: 'flex', marginBottom: 20, borderRadius: 8, overflow: 'hidden', border: '.5px solid var(--brd)' }}>
          {steps.map((s, i) => (
            <div key={s} style={{ flex: 1, padding: '7px 4px', textAlign: 'center', fontSize: 12, fontWeight: 600, background: i + 1 < step ? 'var(--grn-bg)' : i + 1 === step ? 'var(--pr)' : '#f7f7f7', color: i + 1 < step ? 'var(--grn)' : i + 1 === step ? '#fff' : 'var(--muted)', borderRight: i < 2 ? '.5px solid var(--brd)' : 'none' }}>
              {i + 1 < step ? '✓ ' : ''}{s}
            </div>
          ))}
        </div>

        {step === 1 && (
          <>
            <div className="form-group"><label>Fulde navn *</label><input value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="f.eks. Lars Pedersen" autoFocus /></div>
            <div className="form-group"><label>Email *</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="lars@foto.dk" /></div>
            <div className="form-group"><label>Telefon</label><input value={form.telefon} onChange={e => set('telefon', e.target.value)} placeholder="+45 xx xx xx xx" /></div>
            <div className="form-group"><label>Specialer (kommasepareret)</label><input value={form.specialer} onChange={e => set('specialer', e.target.value)} placeholder="Portræt, Event, Bryllup..." /></div>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>Vælg hvad {form.full_name} må se og gøre i systemet:</div>
            {[
              { key: 'upload', lbl: 'Upload råfiler', sub: 'Kan uploade til tildelte sager' },
              { key: 'se_sag', lbl: 'Se sagsdetaljer', sub: 'Adresse, kunde, tidspunkt' },
              { key: 'se_alle', lbl: 'Se alle sager', sub: 'Ikke kun egne sager' },
              { key: 'rediger', lbl: 'Redigere sager', sub: 'Kan ændre status og noter' },
              { key: 'crm', lbl: 'CRM-adgang', sub: 'Kan se kundeoplysninger' },
            ].map(r => (
              <div key={r.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '.5px solid var(--brd)' }}>
                <div><div style={{ fontWeight: 500, fontSize: 13 }}>{r.lbl}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.sub}</div></div>
                <label className="toggle"><input type="checkbox" checked={perms[r.key]} onChange={e => setPerms(p => ({ ...p, [r.key]: e.target.checked }))} /><span className="tslider"></span></label>
              </div>
            ))}
          </>
        )}

        {step === 3 && (
          <>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>{form.full_name} modtager denne invitation:</div>
            <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 16, border: '.5px solid var(--brd)', marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Fra: VaniaGraphics · dennis@vaniagraphics.dk</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--pr)', marginBottom: 8 }}>Du er inviteret som freelancer</div>
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>Hej {form.full_name},<br /><br />Du er blevet tilføjet som freelancerfotograf hos VaniaGraphics. Klik på linket herunder for at oprette din adgangskode og komme i gang.<br /><br /><span style={{ color: 'var(--blu)', textDecoration: 'underline' }}>Opret din adgang →</span></div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Linket er gyldigt i 48 timer.</div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
          <button className="btn btn-outline btn-sm" style={{ visibility: step > 1 ? 'visible' : 'hidden' }} onClick={() => setStep(s => s - 1)}>← Tilbage</button>
          {step < 3
            ? <button className="btn btn-primary btn-sm" onClick={() => setStep(s => s + 1)}>Næste →</button>
            : <button className="btn btn-green btn-sm" onClick={handleSend} disabled={saving}>{saving ? 'Sender...' : '✓ Send invitation'}</button>
          }
        </div>
      </div>
    </div>
  )
}
