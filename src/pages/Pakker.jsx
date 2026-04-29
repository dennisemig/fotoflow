import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useToast, ToastContainer } from '../hooks/useToast'

export default function Pakker() {
  const [pakker, setPakker] = useState([])
  const [tillaeg, setTillaeg] = useState([])
  const [tab, setTab] = useState('pakker')
  const [showPakkeModal, setShowPakkeModal] = useState(false)
  const [showTillaegModal, setShowTillaegModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const { toasts, toast } = useToast()

  useEffect(() => { fetchAll() }, [])
  async function fetchAll() {
    const [{ data: p }, { data: t }] = await Promise.all([
      supabase.from('pakker').select('*').order('pris'),
      supabase.from('tillaeg').select('*').order('pris')
    ])
    setPakker(p || []); setTillaeg(t || [])
  }

  async function deletePakke(id) {
    if (!confirm('Slet denne pakke?')) return
    await supabase.from('pakker').delete().eq('id', id)
    fetchAll(); toast('Pakke slettet')
  }
  async function deleteTillaeg(id) {
    if (!confirm('Slet dette tillæg?')) return
    await supabase.from('tillaeg').delete().eq('id', id)
    fetchAll(); toast('Tillæg slettet')
  }

  return (
    <div>
      <ToastContainer toasts={toasts} />
      <div className="page-title">Pakker & Tillæg</div>

      <div style={{ background: 'var(--surf)', borderBottom: '.5px solid var(--brd)', marginBottom: 20 }}>
        <div style={{ display: 'flex' }}>
          {[{ id: 'pakker', lbl: '📦 Pakker' }, { id: 'tillaeg', lbl: '➕ Tillæg' }].map(t => (
            <div key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: '11px 18px', fontSize: 13, fontWeight: tab === t.id ? 700 : 500, cursor: 'pointer', color: tab === t.id ? 'var(--pr)' : 'var(--muted)', borderBottom: tab === t.id ? '2.5px solid var(--pr)' : '2.5px solid transparent' }}>
              {t.lbl}
            </div>
          ))}
        </div>
      </div>

      {tab === 'pakker' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button className="btn btn-primary btn-sm" onClick={() => { setEditItem(null); setShowPakkeModal(true) }}>+ Opret pakke</button>
          </div>
          {pakker.length === 0 ? (
            <div className="card"><div className="empty-state"><div className="empty-icon">📦</div>Ingen pakker endnu – opret din første!</div></div>
          ) : (
            <div className="grid3">
              {pakker.map(p => (
                <div key={p.id} style={{ background: 'var(--surf)', borderRadius: 'var(--rad)', border: p.popular ? '2px solid var(--gold)' : '.5px solid var(--brd)', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px', borderBottom: '.5px solid var(--brd)' }}>
                    {p.popular && <div style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'var(--gold-bg)', color: '#b45309', marginBottom: 6 }}>⭐ Mest populær</div>}
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--pr)', marginBottom: 4 }}>{p.navn}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, lineHeight: 1.4 }}>{p.beskrivelse}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--pr)' }}>{p.pris?.toLocaleString('da-DK')} kr <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)' }}>ekskl. moms</span></div>
                  </div>
                  <div style={{ padding: '12px 16px' }}>
                    {(p.features || []).map((f, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--grn)', flexShrink: 0 }}></div>{f}
                      </div>
                    ))}
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>Op til {p.max_billeder} billeder · {p.leveringstid}</div>
                  </div>
                  <div style={{ padding: '10px 16px', borderTop: '.5px solid var(--brd)', display: 'flex', gap: 6 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => { setEditItem(p); setShowPakkeModal(true) }}>✏ Rediger</button>
                    <button className="btn btn-red btn-sm" onClick={() => deletePakke(p.id)}>Slet</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'tillaeg' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button className="btn btn-primary btn-sm" onClick={() => { setEditItem(null); setShowTillaegModal(true) }}>+ Opret tillæg</button>
          </div>
          {tillaeg.length === 0 ? (
            <div className="card"><div className="empty-state"><div className="empty-icon">➕</div>Ingen tillæg endnu</div></div>
          ) : (
            <div className="grid3">
              {tillaeg.map(t => (
                <div key={t.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 24 }}>{t.ikon}</div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--pr)' }}>{t.navn}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>{t.beskrivelse}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--pr)' }}>+ {t.pris?.toLocaleString('da-DK')} kr</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => { setEditItem(t); setShowTillaegModal(true) }}>✏ Rediger</button>
                    <button className="btn btn-red btn-sm" onClick={() => deleteTillaeg(t.id)}>Slet</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showPakkeModal && <PakkeModal item={editItem} onClose={() => setShowPakkeModal(false)} onSaved={() => { setShowPakkeModal(false); fetchAll(); toast('✓ Pakke gemt') }} toast={toast} />}
      {showTillaegModal && <TillaegModal item={editItem} onClose={() => setShowTillaegModal(false)} onSaved={() => { setShowTillaegModal(false); fetchAll(); toast('✓ Tillæg gemt') }} toast={toast} />}
    </div>
  )
}

function PakkeModal({ item, onClose, onSaved, toast }) {
  const [form, setForm] = useState({ navn: item?.navn || '', beskrivelse: item?.beskrivelse || '', pris: item?.pris || '', max_billeder: item?.max_billeder || 20, leveringstid: item?.leveringstid || '48 timer', popular: item?.popular || false, features: (item?.features || []).join('\n') })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.navn || !form.pris) { toast('Udfyld navn og pris', 'error'); return }
    setSaving(true)
    const data = { navn: form.navn, beskrivelse: form.beskrivelse, pris: parseFloat(form.pris), max_billeder: parseInt(form.max_billeder), leveringstid: form.leveringstid, popular: form.popular, features: form.features.split('\n').map(f => f.trim()).filter(Boolean) }
    if (item) await supabase.from('pakker').update(data).eq('id', item.id)
    else await supabase.from('pakker').insert([data])
    setSaving(false); onSaved()
  }

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">{item ? 'Rediger pakke' : 'Opret pakke'}<button className="modal-close" onClick={onClose}>✕</button></div>
        <div className="form-group"><label>Pakkenavn *</label><input value={form.navn} onChange={e => set('navn', e.target.value)} placeholder="f.eks. Standard" autoFocus /></div>
        <div className="form-group"><label>Beskrivelse</label><input value={form.beskrivelse} onChange={e => set('beskrivelse', e.target.value)} placeholder="Kort beskrivelse til mægleren..." /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group"><label>Pris (kr.) *</label><input type="number" value={form.pris} onChange={e => set('pris', e.target.value)} placeholder="2995" /></div>
          <div className="form-group"><label>Maks billeder</label><input type="number" value={form.max_billeder} onChange={e => set('max_billeder', e.target.value)} /></div>
        </div>
        <div className="form-group">
          <label>Leveringstid</label>
          <select value={form.leveringstid} onChange={e => set('leveringstid', e.target.value)}>
            {['24 timer', '48 timer', '3 hverdage', '5 hverdage'].map(v => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className="form-group"><label>Hvad er inkluderet (én pr. linje)</label><textarea rows={4} value={form.features} onChange={e => set('features', e.target.value)} placeholder="HDR-behandling&#10;Levering via Mindworking&#10;Preview-link..." /></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <input type="checkbox" id="popular" checked={form.popular} onChange={e => set('popular', e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--pr)' }} />
          <label htmlFor="popular" style={{ fontSize: 13, cursor: 'pointer' }}>Markér som "Mest populær"</label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Annuller</button>
          <button className="btn btn-green btn-sm" onClick={handleSave} disabled={saving}>{saving ? 'Gemmer...' : 'Gem pakke'}</button>
        </div>
      </div>
    </div>
  )
}

function TillaegModal({ item, onClose, onSaved, toast }) {
  const [form, setForm] = useState({ navn: item?.navn || '', beskrivelse: item?.beskrivelse || '', pris: item?.pris || '', ikon: item?.ikon || '➕' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    if (!form.navn || !form.pris) { toast('Udfyld navn og pris', 'error'); return }
    setSaving(true)
    const data = { navn: form.navn, beskrivelse: form.beskrivelse, pris: parseFloat(form.pris), ikon: form.ikon }
    if (item) await supabase.from('tillaeg').update(data).eq('id', item.id)
    else await supabase.from('tillaeg').insert([data])
    setSaving(false); onSaved()
  }

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">{item ? 'Rediger tillæg' : 'Opret tillæg'}<button className="modal-close" onClick={onClose}>✕</button></div>
        <div className="form-group"><label>Navn *</label><input value={form.navn} onChange={e => set('navn', e.target.value)} placeholder="f.eks. Drone" autoFocus /></div>
        <div className="form-group"><label>Beskrivelse</label><textarea rows={2} value={form.beskrivelse} onChange={e => set('beskrivelse', e.target.value)} placeholder="Hvad får mægleren med dette tillæg?" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group"><label>Pris (kr.) *</label><input type="number" value={form.pris} onChange={e => set('pris', e.target.value)} placeholder="795" /></div>
          <div className="form-group"><label>Ikon (emoji)</label><input value={form.ikon} onChange={e => set('ikon', e.target.value)} maxLength={2} /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Annuller</button>
          <button className="btn btn-green btn-sm" onClick={handleSave} disabled={saving}>{saving ? 'Gemmer...' : 'Gem tillæg'}</button>
        </div>
      </div>
    </div>
  )
}
