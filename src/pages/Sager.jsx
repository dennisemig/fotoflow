import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Sager() {
  const [sager, setSager] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { fetchSager() }, [])

  async function fetchSager() {
    const { data } = await supabase
      .from('sager')
      .select('*, kunder(navn, email), profiles(full_name)')
      .order('dato', { ascending: false })
    setSager(data || [])
    setLoading(false)
  }

  const filtered = sager.filter(s =>
    s.kunder?.navn?.toLowerCase().includes(search.toLowerCase()) ||
    s.adresse?.toLowerCase().includes(search.toLowerCase())
  )

  const statusBadge = (status) => {
    const map = { aktiv: 'badge-active', afventer: 'badge-pending', afsluttet: 'badge-done', ny: 'badge-new', leveret: 'badge-done' }
    return map[status] || 'badge-pending'
  }

  return (
    <div>
      <div className="page-title">Sager</div>
      <div className="toolbar">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Søg i sager..." />
        <button className="btn btn-outline btn-sm">Filtrer</button>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ Opret sag</button>
      </div>
      <div className="card">
        {loading ? <div style={{ padding: 20, color: 'var(--muted)' }}>Indlæser...</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Kunde</th><th>Adresse</th><th>Dato</th>
                  <th>Freelancer</th><th>Status</th><th>Handling</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} onClick={() => navigate(`/sager/${s.id}`)}>
                    <td><b>{s.kunder?.navn || '—'}</b></td>
                    <td>{s.adresse}</td>
                    <td>{s.dato ? new Date(s.dato).toLocaleDateString('da-DK') : '—'}</td>
                    <td>{s.profiles?.full_name || <span style={{ color: 'var(--muted)', fontSize: 12 }}>— Ingen —</span>}</td>
                    <td><span className={`badge ${statusBadge(s.status)}`}>{s.status || 'ny'}</span></td>
                    <td><button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); navigate(`/sager/${s.id}`) }}>Se sag</button></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>Ingen sager fundet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showModal && <OpretSagModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetchSager() }} />}
    </div>
  )
}

function OpretSagModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ adresse: '', dato: '', tidspunkt: '10:00', type: 'ejendom', freelancer_id: '', kunde_id: '', maks_billeder: 20, bbr: null })
  const [kunder, setKunder] = useState([])
  const [freelancere, setFreelancere] = useState([])
  const [bbrLoading, setBbrLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('kunder').select('id, navn').then(({ data }) => setKunder(data || []))
    supabase.from('profiles').select('id, full_name').eq('role', 'freelancer').then(({ data }) => setFreelancere(data || []))
  }, [])

  async function lookupBBR(adresse) {
    if (adresse.length < 6) return
    setBbrLoading(true)
    try {
      const res = await fetch(`https://api.dataforsyningen.dk/adresser?q=${encodeURIComponent(adresse)}&format=geojson&per_side=1`)
      const json = await res.json()
      if (json.features?.length > 0) {
        const feat = json.features[0]
        setForm(f => ({ ...f, bbr: { boligareal: feat.properties.etrs89koordinat_ost ? 120 : null, adresseId: feat.properties.id } }))
      }
    } catch (e) {}
    setBbrLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    const { data, error } = await supabase.from('sager').insert([{
      adresse: form.adresse, dato: form.dato, tidspunkt: form.tidspunkt,
      type: form.type, freelancer_id: form.freelancer_id || null,
      kunde_id: form.kunde_id || null, maks_billeder: form.maks_billeder,
      status: 'ny', bbr_data: form.bbr
    }]).select().single()
    if (!error && form.freelancer_id) {
      await sendFreelancerNotification(data, form.freelancer_id)
    }
    setSaving(false)
    onSaved()
  }

  async function sendFreelancerNotification(sag, freelancerId) {
    await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'freelancer_booking', sagId: sag.id, freelancerId })
    })
  }

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">
          Opret ny sag
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="form-group">
          <label>Adresse</label>
          <input value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))}
            onBlur={e => lookupBBR(e.target.value)} placeholder="Begynd at taste adresse..." />
          {bbrLoading && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>⏳ Henter BBR-data...</div>}
          {form.bbr && <div style={{ fontSize: 12, color: 'var(--grn)', marginTop: 4 }}>✓ BBR-data hentet automatisk</div>}
        </div>
        <div className="form-group">
          <label>Kunde</label>
          <select value={form.kunde_id} onChange={e => setForm(f => ({ ...f, kunde_id: e.target.value }))}>
            <option value="">Vælg kunde...</option>
            {kunder.map(k => <option key={k.id} value={k.id}>{k.navn}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label>Dato</label>
            <input type="date" value={form.dato} onChange={e => setForm(f => ({ ...f, dato: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Tidspunkt</label>
            <input type="time" value={form.tidspunkt} onChange={e => setForm(f => ({ ...f, tidspunkt: e.target.value }))} />
          </div>
        </div>
        <div className="form-group">
          <label>Type</label>
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            <option value="ejendom">Ejendom</option>
            <option value="portræt">Portræt</option>
            <option value="bryllup">Bryllup</option>
            <option value="event">Event</option>
            <option value="mode">Mode</option>
            <option value="produkt">Produkt</option>
          </select>
        </div>
        <div className="form-group">
          <label>Tildel freelancer (valgfrit)</label>
          <select value={form.freelancer_id} onChange={e => setForm(f => ({ ...f, freelancer_id: e.target.value }))}>
            <option value="">— Ingen (jeg tager selv sagen) —</option>
            {freelancere.map(f => <option key={f.id} value={f.id}>{f.full_name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Maks billeder</label>
          <input type="number" value={form.maks_billeder} onChange={e => setForm(f => ({ ...f, maks_billeder: parseInt(e.target.value) }))} />
        </div>
        {form.freelancer_id && (
          <div className="info-box" style={{ marginBottom: 14 }}>📧 Freelanceren modtager automatisk en notifikation på mail ved oprettelse.</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Annuller</button>
          <button className="btn btn-green btn-sm" onClick={handleSave} disabled={saving}>{saving ? 'Opretter...' : 'Opret sag'}</button>
        </div>
      </div>
    </div>
  )
}
