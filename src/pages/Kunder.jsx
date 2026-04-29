import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast, ToastContainer } from '../hooks/useToast'

export default function Kunder() {
  const [kunder, setKunder] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const navigate = useNavigate()
  const { toasts, toast } = useToast()

  useEffect(() => { fetch() }, [])
  async function fetch() {
    const { data } = await supabase.from('kunder').select('*').order('navn')
    setKunder(data || []); setLoading(false)
  }

  const filtered = kunder.filter(k =>
    k.navn?.toLowerCase().includes(search.toLowerCase()) ||
    k.email?.toLowerCase().includes(search.toLowerCase()) ||
    k.telefon?.includes(search)
  )

  return (
    <div>
      <ToastContainer toasts={toasts} />
      <div className="page-title">Kunder (CRM)</div>
      <div className="toolbar">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Søg på navn, email eller telefon..." />
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ Opret kunde</button>
      </div>
      <div className="card">
        {loading ? <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Indlæser...</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Navn</th><th>Telefon</th><th>Email</th><th>Tags</th><th>Handling</th></tr></thead>
              <tbody>
                {filtered.map(k => (
                  <tr key={k.id} onClick={() => navigate(`/kunder/${k.id}`)}>
                    <td><b>{k.navn}</b></td>
                    <td>{k.telefon || '—'}</td>
                    <td>{k.email || '—'}</td>
                    <td>{(k.tags || []).map(t => <span key={t} className="tag">{t}</span>)}</td>
                    <td onClick={e => e.stopPropagation()}><button className="btn btn-outline btn-sm" onClick={() => navigate(`/kunder/${k.id}`)}>Se profil</button></td>
                  </tr>
                ))}
                {filtered.length === 0 && !loading && (
                  <tr><td colSpan={5}><div className="empty-state"><div className="empty-icon">👥</div>Ingen kunder endnu – opret din første!</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showModal && <OpretKundeModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetch(); toast('✓ Kunde oprettet!') }} toast={toast} />}
    </div>
  )
}

function OpretKundeModal({ onClose, onSaved, toast }) {
  const [form, setForm] = useState({ navn: '', email: '', telefon: '', noter: '', tags: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.navn.trim()) { toast('Navn er påkrævet', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('kunder').insert([{
      navn: form.navn, email: form.email, telefon: form.telefon, noter: form.noter,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : []
    }])
    setSaving(false)
    if (error) toast('Fejl ved oprettelse: ' + error.message, 'error')
    else onSaved()
  }

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">Opret ny kunde<button className="modal-close" onClick={onClose}>✕</button></div>
        <div className="form-group"><label>Navn *</label><input value={form.navn} onChange={e => set('navn', e.target.value)} placeholder="Fulde navn eller firmanavn" autoFocus /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@eksempel.dk" /></div>
          <div className="form-group"><label>Telefon</label><input value={form.telefon} onChange={e => set('telefon', e.target.value)} placeholder="+45 xx xx xx xx" /></div>
        </div>
        <div className="form-group"><label>Tags (kommasepareret)</label><input value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="Portræt, Fast kunde, Bryllup..." /></div>
        <div className="form-group"><label>Noter</label><textarea rows={3} value={form.noter} onChange={e => set('noter', e.target.value)} placeholder="Interne noter om kunden..." /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Annuller</button>
          <button className="btn btn-green btn-sm" onClick={handleSave} disabled={saving}>{saving ? 'Gemmer...' : 'Opret kunde'}</button>
        </div>
      </div>
    </div>
  )
}
