import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast, ToastContainer } from '../hooks/useToast'

const TYPES = ['ejendom', 'portræt', 'bryllup', 'event', 'mode', 'produkt']

export default function Kalender() {
  const [sager, setSager] = useState([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth())
  const [showModal, setShowModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const navigate = useNavigate()
  const { toasts, toast } = useToast()

  useEffect(() => { fetchSager(); fetchBlokeringer() }, [year, month])
  const [blokeringer, setBlokeringer] = useState([])
  const [showBlokerModal, setShowBlokerModal] = useState(false)
  const [blokerDato, setBlokerDato] = useState(null)

  async function fetchBlokeringer() {
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`
    const { data } = await supabase.from('kalender_blokeringer').select('*').gte('dato', from).lte('dato', to)
    setBlokeringer(data || [])
  }

  async function fetchSager() {
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`
    const { data, error } = await supabase
      .from('sager')
      .select('id, adresse, dato, status, tidspunkt, tidspunkt_slut')
      .gte('dato', from)
      .lte('dato', to)
      .order('dato')
      .order('tidspunkt', { ascending: true, nullsFirst: false })
    if (error) console.error('Kalender fejl:', error)
    setSager(data || [])
  }

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = (new Date(year, month, 1).getDay() || 7) - 1
  const todayStr = new Date().toISOString().split('T')[0]
  const monthName = new Date(year, month, 1).toLocaleString('da-DK', { month: 'long', year: 'numeric' })

  const sagsForDay = (day) => {
    const d = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return sager.filter(s => s.dato === d)
  }

  const blokeringerForDay = (day) => {
    const d = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return blokeringer.filter(b => b.dato === d)
  }

  const todayDay = new Date().getDate()
  const todayMonth = new Date().getMonth()
  const todayYear = new Date().getFullYear()

  const statusColor = s => ({
    aktiv: '#2e7d4f', afventer: '#e5a243', leveret: '#0c447c', ny: '#3A4A5A', afsluttet: '#6b7280'
  }[s] || '#3A4A5A')

  return (
    <div>
      <ToastContainer toasts={toasts} />
      <div className="page-title">Kalender</div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button className="btn btn-outline btn-sm" onClick={prevMonth}>&#8249; Forrige</button>
          <div style={{ fontWeight: 700, fontSize: 16, textTransform: 'capitalize', color: 'var(--pr)' }}>{monthName}</div>
          <button className="btn btn-outline btn-sm" onClick={nextMonth}>Næste &#8250;</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginBottom: 4 }}>
          {['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', fontWeight: 600, padding: '4px 0' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
          {Array.from({ length: firstDay }).map((_, i) => <div key={'e' + i} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const isToday = day === todayDay && month === todayMonth && year === todayYear
            const daySager = sagsForDay(day)
            const isWeekend = ((firstDay + i) % 7) >= 5
            return (
              <div key={day}
                onClick={() => { setSelectedDate(dayStr); setShowModal(true) }}
                onContextMenu={e => { e.preventDefault(); setBlokerDato(dayStr); setShowBlokerModal(true) }}
                style={{ minHeight: 72, background: isToday ? '#eef4f8' : isWeekend ? '#fafafa' : 'transparent', borderRadius: 8, padding: '5px 6px', border: isToday ? '2px solid var(--pr)' : '.5px solid var(--brd)', cursor: 'pointer' }}
                onMouseEnter={e => { if (!isToday) e.currentTarget.style.background = '#f5f7f9' }}
                onMouseLeave={e => { if (!isToday) e.currentTarget.style.background = isWeekend ? '#fafafa' : 'transparent' }}>
                <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--pr)' : isWeekend ? 'var(--muted)' : 'var(--txt)', marginBottom: 3 }}>{day}</div>
                {daySager.map(s => (
                  <div key={s.id}
                    onClick={e => { e.stopPropagation(); navigate('/sager/' + s.id) }}
                    style={{ fontSize: 9, fontWeight: 600, padding: '2px 5px', borderRadius: 4, marginBottom: 2, cursor: 'pointer', background: statusColor(s.status), color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={s.adresse}>
                    {s.tidspunkt ? String(s.tidspunkt).slice(0, 5) : ''}{s.tidspunkt_slut ? `–${String(s.tidspunkt_slut).slice(0, 5)}` : ''}{' '}{s.adresse ? s.adresse.split(',')[0] : ''}
                  </div>
                ))}
                {blokeringerForDay(day).map(b => (
                  <div key={b.id} style={{ fontSize: 9, fontWeight: 600, padding: '2px 5px', borderRadius: 4, marginBottom: 2, background: '#e53e3e', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={b.beskrivelse || 'Blokeret'}>
                    🚫 {b.tidspunkt ? String(b.tidspunkt).slice(0,5) : ''}{b.tidspunkt_slut ? `–${String(b.tidspunkt_slut).slice(0,5)}` : ''}{!b.tidspunkt ? 'Hele dagen' : ''} {b.beskrivelse || ''}
                  </div>
                ))}
                {daySager.length === 0 && blokeringerForDay(day).length === 0 && <div style={{ fontSize: 9, color: '#ddd', marginTop: 2 }}>+ Tilføj</div>}
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 14, paddingTop: 12, borderTop: '.5px solid var(--brd)', flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { color: '#3A4A5A', label: 'Ny' },
            { color: '#2e7d4f', label: 'Aktiv' },
            { color: '#e5a243', label: 'Afventer' },
            { color: '#0c447c', label: 'Leveret' },
            { color: '#6b7280', label: 'Afsluttet' }
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color }}></div>
              <span style={{ color: 'var(--muted)' }}>{l.label}</span>
            </div>
          ))}
          <button className="btn btn-outline btn-sm" onClick={() => { setBlokerDato(todayStr); setShowBlokerModal(true) }}>🚫 Bloker tid</button>
          <button className="btn btn-primary btn-sm" onClick={() => { setSelectedDate(todayStr); setShowModal(true) }}>+ Opret sag</button>
        </div>
      </div>

      <div className="card">
        <div className="section-hd">Sager i {monthName} ({sager.length})</div>
        {sager.length === 0
          ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>Ingen sager denne måned – klik på en dag for at oprette</div>
          : sager.map(s => (
            <div key={s.id}
              onClick={() => navigate('/sager/' + s.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--bg)', borderRadius: 8, marginBottom: 6, cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = '#e8edf1'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--bg)'}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: statusColor(s.status), flexShrink: 0 }}></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{s.adresse}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {new Date(s.dato + 'T12:00:00').toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })}
                  {s.tidspunkt ? ' · kl. ' + String(s.tidspunkt).slice(0, 5) : ''}
                  {s.tidspunkt_slut ? ' – ' + String(s.tidspunkt_slut).slice(0, 5) : ''}
                </div>
              </div>
              <span className={'badge badge-' + (s.status === 'aktiv' ? 'active' : s.status === 'afventer' ? 'pending' : s.status === 'ny' ? 'new' : 'done')}>
                {({ ny: 'Ny', aktiv: 'Aktiv', afventer: 'Afventer', afsluttet: 'Afsluttet', leveret: 'Leveret' }[s.status] || 'Ny')}
              </span>
            </div>
          ))
        }
      </div>

      {showBlokerModal && (
        <BlokerModal
          dato={blokerDato}
          onClose={() => setShowBlokerModal(false)}
          onSaved={() => { setShowBlokerModal(false); fetchBlokeringer(); toast('✓ Tid blokeret!') }}
          toast={toast}
        />
      )}

      {showModal && (
        <OpretSagModal
          dato={selectedDate}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); fetchSager(); toast('Sag oprettet!') }}
          toast={toast}
        />
      )}
    </div>
  )
}

function OpretSagModal({ dato, onClose, onSaved, toast }) {
  const [form, setForm] = useState({ adresse: '', tidspunkt: '09:00', tidspunkt_slut: '11:00', type: 'ejendom', kunde_id: '', freelancer_id: '', maks_billeder: 20, noter: '' })
  const [kunder, setKunder] = useState([])
  const [freelancere, setFreelancere] = useState([])
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    supabase.from('kunder').select('id, navn').order('navn').then(({ data }) => setKunder(data || []))
    supabase.from('freelancere').select('id, navn').eq('aktiv', true).then(({ data }) => setFreelancere(data || []))
  }, [])

  const datoLabel = dato ? new Date(dato + 'T12:00:00').toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''

  async function handleSave() {
    if (!form.adresse) { toast('Udfyld adresse', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('sager').insert([{
      adresse: form.adresse,
      dato: dato,
      tidspunkt: form.tidspunkt || null,
      tidspunkt_slut: form.tidspunkt_slut || null,
      type: form.type,
      kunde_id: form.kunde_id || null,
      freelancer_id: form.freelancer_id || null,
      maks_billeder: form.maks_billeder,
      noter: form.noter || null,
      status: 'ny'
    }])
    if (error) { toast('Fejl: ' + error.message, 'error'); setSaving(false); return }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">
          Opret sag
          {datoLabel && <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted)', marginLeft: 8 }}>– {datoLabel}</span>}
          <button className="modal-close" onClick={onClose}>&#10005;</button>
        </div>
        <div className="form-group"><label>Adresse *</label><input value={form.adresse} onChange={e => set('adresse', e.target.value)} placeholder="f.eks. Lyngvigvej 12, 2750 Ballerup" autoFocus /></div>
        <div className="form-group"><label>Kunde (valgfrit)</label>
          <select value={form.kunde_id} onChange={e => set('kunde_id', e.target.value)}>
            <option value="">-- Vælg kunde --</option>
            {kunder.map(k => <option key={k.id} value={k.id}>{k.navn}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group"><label>Fra</label><input type="time" value={form.tidspunkt} onChange={e => set('tidspunkt', e.target.value)} /></div>
          <div className="form-group"><label>Til</label><input type="time" value={form.tidspunkt_slut} onChange={e => set('tidspunkt_slut', e.target.value)} /></div>
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
            <option value="">-- Ingen freelancer --</option>
            {freelancere.map(f => <option key={f.id} value={f.id}>{f.navn}</option>)}
          </select>
        </div>
        <div className="form-group"><label>Noter</label><textarea rows={2} value={form.noter} onChange={e => set('noter', e.target.value)} placeholder="Sagsbeskrivelse..." /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Annuller</button>
          <button className="btn btn-green btn-sm" onClick={handleSave} disabled={saving}>{saving ? 'Opretter...' : 'Opret sag'}</button>
        </div>
      </div>
    </div>
  )
}

function BlokerModal({ dato, onClose, onSaved, toast }) {
  const [form, setForm] = useState({ dato: dato || '', beskrivelse: '', tidspunkt: '', tidspunkt_slut: '', heldag: true })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const datoLabel = form.dato ? new Date(form.dato + 'T12:00:00').toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''

  async function handleSave() {
    if (!form.dato) { toast('Vælg en dato', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('kalender_blokeringer').insert([{
      dato: form.dato,
      beskrivelse: form.beskrivelse || null,
      tidspunkt: form.heldag ? null : (form.tidspunkt || null),
      tidspunkt_slut: form.heldag ? null : (form.tidspunkt_slut || null),
    }])
    if (error) { toast('Fejl: ' + error.message, 'error'); setSaving(false); return }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">
          🚫 Bloker tid
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="form-group">
          <label>Dato *</label>
          <input type="date" value={form.dato} onChange={e => set('dato', e.target.value)} min={new Date().toISOString().split('T')[0]} />
          {datoLabel && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{datoLabel}</div>}
        </div>
        <div className="form-group">
          <label>Beskrivelse (valgfrit)</label>
          <input value={form.beskrivelse} onChange={e => set('beskrivelse', e.target.value)} placeholder="Ferie, møde, fri..." />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.heldag} onChange={e => set('heldag', e.target.checked)} />
            Hele dagen
          </label>
        </div>
        {!form.heldag && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group"><label>Fra</label><input type="time" value={form.tidspunkt} onChange={e => set('tidspunkt', e.target.value)} /></div>
            <div className="form-group"><label>Til</label><input type="time" value={form.tidspunkt_slut} onChange={e => set('tidspunkt_slut', e.target.value)} /></div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Annuller</button>
          <button className="btn btn-sm" style={{ background: '#e53e3e', color: '#fff' }} onClick={handleSave} disabled={saving}>{saving ? 'Gemmer...' : '🚫 Bloker'}</button>
        </div>
      </div>
    </div>
  )
}
