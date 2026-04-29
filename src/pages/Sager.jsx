import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast, ToastContainer } from '../hooks/useToast'

const TYPES = ['ejendom', 'portræt', 'bryllup', 'event', 'mode', 'produkt']

export default function Sager() {
  const [sager, setSager] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const navigate = useNavigate()
  const { toasts, toast } = useToast()

  useEffect(() => { fetchSager() }, [])

  async function fetchSager() {
    setLoading(true)
    // Hent sager uden join til profiles
    const { data: sagerData, error } = await supabase
      .from('sager')
      .select('id, adresse, dato, status, type, kunde_id, freelancer_id, created_at')
      .order('created_at', { ascending: false })

    if (error) { console.error('Sager fejl:', error); setLoading(false); return }
    if (!sagerData || sagerData.length === 0) { setSager([]); setLoading(false); return }

    // Hent kunder separat
    const kundeIds = [...new Set(sagerData.filter(s => s.kunde_id).map(s => s.kunde_id))]
    let kundeMap = {}
    if (kundeIds.length > 0) {
      const { data: kunderData } = await supabase.from('kunder').select('id, navn').in('id', kundeIds)
      if (kunderData) kunderData.forEach(k => { kundeMap[k.id] = k })
    }

    // Hent freelancere separat
    const flIds = [...new Set(sagerData.filter(s => s.freelancer_id).map(s => s.freelancer_id))]
    let flMap = {}
    if (flIds.length > 0) {
      const { data: flData } = await supabase.from('freelancere').select('id, navn').in('id', flIds)
      if (flData) flData.forEach(f => { flMap[f.id] = f })
    }

    const merged = sagerData.map(s => ({
      ...s,
      kunde: kundeMap[s.kunde_id] || null,
      freelancer: flMap[s.freelancer_id] || null
    }))
    setSager(merged)
    setLoading(false)
  }

  const filtered = sager.filter(s =>
    (s.kunde?.navn || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.adresse || '').toLowerCase().includes(search.toLowerCase())
  )

  const badgeClass = s => ({ aktiv: 'active', afventer: 'pending', leveret: 'leveret', ny: 'new', afsluttet: 'done' }[s] || 'new')
  const statusLabel = s => ({ ny: 'Ny', aktiv: 'Aktiv', afventer: 'Afventer', afsluttet: 'Afsluttet', leveret: 'Leveret' }[s] || 'Ny')

  return (
    <div>
      <ToastContainer toasts={toasts} />
      <div className="page-title">Sager</div>
      <div className="toolbar">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Søg på kunde eller adresse..." />
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ Opret sag</button>
      </div>
      <div className="card">
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Indlæser sager...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">📋</div>Ingen sager endnu – opret din første!</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Kunde</th><th>Adresse</th><th>Dato</th><th>Type</th><th>Freelancer</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} onClick={() => navigate(`/sager/${s.id}`)}>
                    <td><b>{s.kunde?.navn || '—'}</b></td>
                    <td>{s.adresse || '—'}</td>
                    <td>{s.dato ? new Date(s.dato).toLocaleDateString('da-DK') : '—'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{s.type || '—'}</td>
                    <td>{s.freelancer?.navn || <span style={{ color: 'var(--muted)', fontSize: 12 }}>Ingen</span>}</td>
                    <td><span className={`badge badge-${badgeClass(s.status)}`}>{statusLabel(s.status)}</span></td>
                    <td onClick={e => e.stopPropagation()}><button className="btn btn-outline btn-sm" onClick={() => navigate(`/sager/${s.id}`)}>Se sag</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showModal && <OpretSagModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetchSager(); toast('✓ Sag oprettet!') }} toast={toast} />}
    </div>
  )
}

function OpretSagModal({ onClose, onSaved, toast }) {
  const [form, setForm] = useState({ adresse: '', dato: '', tidspunkt: '10:00', type: 'ejendom', freelancer_id: '', kunde_id: '', maks_billeder: 20, noter: '' })
  const [kunder, setKunder] = useState([])
  const [freelancere, setFreelancere] = useState([])
  const [bbr, setBbr] = useState(null)
  const [bbrLoading, setBbrLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    supabase.from('kunder').select('id, navn').order('navn').then(({ data }) => setKunder(data || []))
    supabase.from('freelancere').select('id, navn').eq('aktiv', true).then(({ data }) => setFreelancere(data || []))
  }, [])

  async function lookupBBR(adresse) {
    if (adresse.length < 6) return
    setBbrLoading(true)
    try {
      const r = await fetch(`https://api.dataforsyningen.dk/adresser?q=${encodeURIComponent(adresse)}&per_side=1`)
      const d = await r.json()
      if (d.length > 0) setBbr({ vejnavn: d[0].vejnavn, postnr: d[0].postnr })
    } catch (e) { }
    setBbrLoading(false)
  }

  async function handleSave() {
    if (!form.adresse || !form.dato) { toast('Udfyld adresse og dato', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('sager').insert([{
      adresse: form.adresse,
      dato: form.dato,
      type: form.type,
      freelancer_id: form.freelancer_id || null,
      kunde_id: form.kunde_id || null,
      maks_billeder: form.maks_billeder,
      noter: form.noter || null,
      status: 'ny',
      bbr_data: bbr || null
    }])
    if (error) { toast('Fejl: ' + error.message, 'error'); setSaving(false); return }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">Opret ny sag<button className="modal-close" onClick={onClose}>✕</button></div>
        <div className="form-group">
          <label>Adresse *</label>
          <input value={form.adresse} onChange={e => set('adresse', e.target.value)} onBlur={e => lookupBBR(e.target.value)} placeholder="f.eks. Lyngvigvej 12, 2750 Ballerup" autoFocus />
          {bbrLoading && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>⏳ Verificerer adresse...</div>}
          {bbr && <div style={{ fontSize: 12, color: 'var(--grn)', marginTop: 4 }}>✓ Adresse fundet</div>}
        </div>
        <div className="form-group"><label>Kunde (valgfrit)</label>
          <select value={form.kunde_id} onChange={e => set('kunde_id', e.target.value)}>
            <option value="">— Vælg eksisterende kunde —</option>
            {kunder.map(k => <option key={k.id} value={k.id}>{k.navn}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group"><label>Dato *</label><input type="date" value={form.dato} onChange={e => set('dato', e.target.value)} /></div>
          <div className="form-group"><label>Tidspunkt</label><input type="time" value={form.tidspunkt} onChange={e => set('tidspunkt', e.target.value)} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group"><label>Type</label>
            <select value={form.type} onChange={e => set('type', e.target.value)}>
              {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Maks billeder</label><input type="number" value={form.maks_billeder} onChange={e => set('maks_billeder', parseInt(e.target.value))} /></div>
        </div>
        <div className="form-group"><label>Freelancer (valgfrit)</label>
          <select value={form.freelancer_id} onChange={e => set('freelancer_id', e.target.value)}>
            <option value="">— Ingen freelancer —</option>
            {freelancere.map(f => <option key={f.id} value={f.id}>{f.navn}</option>)}
          </select>
        </div>
        <div className="form-group"><label>Noter</label><textarea rows={3} value={form.noter} onChange={e => set('noter', e.target.value)} placeholder="Sagsbeskrivelse, særlige ønsker..." /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Annuller</button>
          <button className="btn btn-green btn-sm" onClick={handleSave} disabled={saving}>{saving ? 'Opretter...' : 'Opret sag'}</button>
        </div>
      </div>
    </div>
  )
}
