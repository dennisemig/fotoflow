import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../hooks/useToast'

export default function Pakker() {
  const { showToast, ToastContainer } = useToast()
  const [pakker, setPakker] = useState([])
  const [tillaeg, setTillaeg] = useState([])
  const [tab, setTab] = useState('pakker')
  const [showModal, setShowModal] = useState(false)
  const [showTModal, setShowTModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ navn: '', beskrivelse: '', pris: '', max_billeder: 20, leveringstid: '48 timer', features: '', popular: false })
  const [tform, setTform] = useState({ navn: '', beskrivelse: '', pris: '', ikon: '📷' })

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [{ data: p }, { data: t }] = await Promise.all([
      supabase.from('pakker').select('*').order('sort_order'),
      supabase.from('tillaeg').select('*').order('created_at'),
    ])
    setPakker(p || [])
    setTillaeg(t || [])
  }

  async function savePakke() {
    const payload = { ...form, pris: parseFloat(form.pris), max_billeder: parseInt(form.max_billeder), features: form.features.split('\n').filter(Boolean) }
    if (editId) await supabase.from('pakker').update(payload).eq('id', editId)
    else await supabase.from('pakker').insert(payload)
    showToast('✓ Pakke gemt'); setShowModal(false); setEditId(null); fetchAll()
  }

  async function deletePakke(id) {
    await supabase.from('pakker').delete().eq('id', id)
    showToast('Pakke slettet'); fetchAll()
  }

  async function saveTillaeg() {
    const payload = { ...tform, pris: parseFloat(tform.pris) }
    await supabase.from('tillaeg').insert(payload)
    showToast('✓ Tillæg gemt'); setShowTModal(false); fetchAll()
  }

  function editPakke(p) {
    setEditId(p.id)
    setForm({ ...p, features: p.features?.join('\n') || '' })
    setShowModal(true)
  }

  return (
    <div>
      <ToastContainer />
      <div className="page-title">Pakker & Tillæg</div>
      <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--brd)', marginBottom: 16, width: 'fit-content' }}>
        {[['pakker', 'Pakker'], ['tillaeg', 'Tillæg']].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} style={{ padding: '7px 16px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: tab === v ? 'var(--pr)' : 'var(--surf)', color: tab === v ? '#fff' : 'var(--muted)', borderRight: v === 'pakker' ? '1px solid var(--brd)' : 'none' }}>{l}</button>
        ))}
      </div>

      {tab === 'pakker' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button className="btn btn-primary" onClick={() => { setEditId(null); setForm({ navn: '', beskrivelse: '', pris: '', max_billeder: 20, leveringstid: '48 timer', features: '', popular: false }); setShowModal(true) }}>+ Opret pakke</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: 12 }}>
            {pakker.map(p => (
              <div key={p.id} className="card" style={{ border: p.popular ? '2px solid var(--gold)' : '1.5px solid var(--brd)' }}>
                {p.popular && <div style={{ background: 'var(--gold-bg)', color: '#b45309', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700, marginBottom: 6, display: 'inline-block' }}>⭐ Mest populær</div>}
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--pr)', marginBottom: 4 }}>{p.navn}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{p.beskrivelse}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--pr)', marginBottom: 8 }}>{parseFloat(p.pris).toLocaleString('da-DK')} kr</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Op til {p.max_billeder} billeder · {p.leveringstid}</div>
                {p.features?.map(f => <div key={f} style={{ fontSize: 12, display: 'flex', gap: 6, paddingBottom: 3 }}><span style={{ color: 'var(--grn)' }}>✓</span>{f}</div>)}
                <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => editPakke(p)}>✏ Rediger</button>
                  <button className="btn btn-red btn-sm" onClick={() => deletePakke(p.id)}>Slet</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'tillaeg' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button className="btn btn-primary" onClick={() => setShowTModal(true)}>+ Opret tillæg</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 10 }}>
            {tillaeg.map(t => (
              <div key={t.id} className="card">
                <div style={{ fontSize: 24, marginBottom: 6 }}>{t.ikon}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pr)' }}>{t.navn}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, marginBottom: 8 }}>{t.beskrivelse}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--pr)' }}>+ {parseFloat(t.pris).toLocaleString('da-DK')} kr</div>
              </div>
            ))}
          </div>
        </>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">{editId ? 'Rediger pakke' : 'Opret pakke'} <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18 }} onClick={() => setShowModal(false)}>✕</button></div>
            <div className="form-group"><label>Pakkenavn</label><input value={form.navn} onChange={e => setForm({...form, navn: e.target.value})} /></div>
            <div className="form-group"><label>Beskrivelse</label><textarea rows={2} value={form.beskrivelse} onChange={e => setForm({...form, beskrivelse: e.target.value})} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group"><label>Pris (kr)</label><input type="number" value={form.pris} onChange={e => setForm({...form, pris: e.target.value})} /></div>
              <div className="form-group"><label>Maks billeder</label><input type="number" value={form.max_billeder} onChange={e => setForm({...form, max_billeder: e.target.value})} /></div>
            </div>
            <div className="form-group"><label>Leveringstid</label><select value={form.leveringstid} onChange={e => setForm({...form, leveringstid: e.target.value})}><option>24 timer</option><option>48 timer</option><option>3 hverdage</option><option>5 hverdage</option></select></div>
            <div className="form-group"><label>Hvad er inkluderet (én pr. linje)</label><textarea rows={4} value={form.features} onChange={e => setForm({...form, features: e.target.value})} placeholder="HDR-behandling&#10;Levering via Mindworking&#10;Preview-link" /></div>
            <div className="form-group"><label style={{ display: 'flex', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={form.popular} onChange={e => setForm({...form, popular: e.target.checked})} style={{ width: 16, height: 16 }} /> Markér som "Mest populær"</label></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Annuller</button>
              <button className="btn btn-green" onClick={savePakke}>Gem pakke</button>
            </div>
          </div>
        </div>
      )}

      {showTModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowTModal(false)}>
          <div className="modal">
            <div className="modal-title">Opret tillæg <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18 }} onClick={() => setShowTModal(false)}>✕</button></div>
            <div className="form-group"><label>Navn</label><input value={tform.navn} onChange={e => setTform({...tform, navn: e.target.value})} placeholder="f.eks. Drone" /></div>
            <div className="form-group"><label>Beskrivelse</label><textarea rows={2} value={tform.beskrivelse} onChange={e => setTform({...tform, beskrivelse: e.target.value})} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group"><label>Pris (kr)</label><input type="number" value={tform.pris} onChange={e => setTform({...tform, pris: e.target.value})} /></div>
              <div className="form-group"><label>Ikon (emoji)</label><input value={tform.ikon} onChange={e => setTform({...tform, ikon: e.target.value})} maxLength={2} /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-outline" onClick={() => setShowTModal(false)}>Annuller</button>
              <button className="btn btn-green" onClick={saveTillaeg}>Gem tillæg</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
