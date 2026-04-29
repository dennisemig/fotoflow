import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast, ToastContainer } from '../hooks/useToast'

export default function KundeProfil() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [kunde, setKunde] = useState(null)
  const [sager, setSager] = useState([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const { toasts, toast } = useToast()

  useEffect(() => {
    supabase.from('kunder').select('*').eq('id', id).single().then(({ data }) => { setKunde(data); setForm(data || {}) })
    supabase.from('sager').select('id, adresse, dato, status').eq('kunde_id', id).order('dato', { ascending: false }).then(({ data }) => setSager(data || []))
  }, [id])

  async function handleSave() {
    setSaving(true)
    await supabase.from('kunder').update({
      navn: form.navn, email: form.email, telefon: form.telefon, noter: form.noter,
      tags: typeof form.tags === 'string' ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : (form.tags || [])
    }).eq('id', id)
    setSaving(false); setEditing(false)
    supabase.from('kunder').select('*').eq('id', id).single().then(({ data }) => setKunde(data))
    toast('✓ Kunde opdateret')
  }

  async function handleDelete() {
    if (!confirm('Slet kunden? Dette kan ikke fortrydes.')) return
    await supabase.from('kunder').delete().eq('id', id)
    navigate('/kunder')
  }

  if (!kunde) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Indlæser...</div>

  const statusLabel = s => ({ ny: 'Ny', aktiv: 'Aktiv', afventer: 'Afventer', afsluttet: 'Afsluttet', leveret: 'Leveret' }[s] || 'Ny')
  const badgeClass = s => ({ aktiv: 'active', afventer: 'pending', ny: 'new', afsluttet: 'done', leveret: 'leveret' }[s] || 'new')

  return (
    <div>
      <ToastContainer toasts={toasts} />
      <div className="back-link" onClick={() => navigate('/kunder')}>← Tilbage til kunder</div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--pr)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700 }}>
            {kunde.navn?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            {editing
              ? <input value={form.navn || ''} onChange={e => setForm(f => ({ ...f, navn: e.target.value }))} style={{ fontSize: 18, fontWeight: 700, color: 'var(--pr)', border: '1px solid var(--brd)', borderRadius: 7, padding: '4px 8px', width: '100%' }} />
              : <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--pr)' }}>{kunde.navn}</div>
            }
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{kunde.telefon} · {kunde.email}</div>
            <div style={{ marginTop: 6 }}>{(kunde.tags || []).map(t => <span key={t} className="tag">{t}</span>)}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {editing
              ? <><button className="btn btn-green btn-sm" onClick={handleSave} disabled={saving}>{saving ? 'Gemmer...' : 'Gem'}</button><button className="btn btn-outline btn-sm" onClick={() => setEditing(false)}>Annuller</button></>
              : <><button className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>✏ Rediger</button><button className="btn btn-red btn-sm" onClick={handleDelete}>Slet</button></>
            }
          </div>
        </div>
        {editing && (
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group"><label>Email</label><input value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className="form-group"><label>Telefon</label><input value={form.telefon || ''} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} /></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Tags (kommasepareret)</label><input value={Array.isArray(form.tags) ? form.tags.join(', ') : (form.tags || '')} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} /></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Noter</label><textarea rows={3} value={form.noter || ''} onChange={e => setForm(f => ({ ...f, noter: e.target.value }))} /></div>
          </div>
        )}
      </div>
      <div className="grid2">
        <div className="card">
          <div className="section-hd">Sager ({sager.length})</div>
          {sager.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>Ingen sager endnu</div>
            : sager.map(s => (
              <div key={s.id} onClick={() => navigate(`/sager/${s.id}`)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '.5px solid var(--brd)', cursor: 'pointer' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{s.adresse}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.dato ? new Date(s.dato).toLocaleDateString('da-DK') : '—'}</div>
                </div>
                <span className={`badge badge-${badgeClass(s.status)}`}>{statusLabel(s.status)}</span>
              </div>
            ))
          }
        </div>
        <div className="card">
          <div className="section-hd">Noter</div>
          <div style={{ fontSize: 13, color: kunde.noter ? 'var(--txt)' : 'var(--muted)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {kunde.noter || 'Ingen noter. Klik Rediger for at tilføje.'}
          </div>
        </div>
      </div>
    </div>
  )
}
