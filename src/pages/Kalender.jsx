import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Kalender() {
  const [sager, setSager] = useState([])
  const [view, setView] = useState('uge')
  const navigate = useNavigate()
  const today = new Date()

  useEffect(() => {
    const from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
    const to = new Date(today.getFullYear(), today.getMonth() + 2, 0).toISOString().split('T')[0]
    supabase.from('sager').select('*, kunder(navn)').gte('dato', from).lte('dato', to).order('dato')
      .then(({ data }) => setSager(data || []))
  }, [])

  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const firstDay = (new Date(today.getFullYear(), today.getMonth(), 1).getDay() || 7) - 1
  const monthName = today.toLocaleString('da-DK', { month: 'long', year: 'numeric' })

  const sagsForDay = day => {
    const d = new Date(today.getFullYear(), today.getMonth(), day).toISOString().split('T')[0]
    return sager.filter(s => s.dato === d)
  }

  const statusColor = s => s === 'aktiv' ? 'var(--grn)' : s === 'afventer' ? 'var(--gold)' : s === 'leveret' ? 'var(--blu)' : 'var(--pr)'

  return (
    <div>
      <div className="page-title">Kalender</div>
      <div className="toolbar">
        {['dag', 'uge', 'maaned'].map(v => (
          <button key={v} className={`btn btn-sm ${view === v ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView(v)}>
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
        <div style={{ flex: 1 }}></div>
        <div style={{ fontWeight: 600, color: 'var(--pr)', textTransform: 'capitalize' }}>{monthName}</div>
      </div>

      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 8 }}>
          {['Man','Tir','Ons','Tor','Fre','Lør','Søn'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', fontWeight: 600, padding: '6px 0' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
          {[...Array(firstDay)].map((_, i) => <div key={`e${i}`} />)}
          {[...Array(daysInMonth)].map((_, i) => {
            const day = i + 1
            const isToday = day === today.getDate()
            const daySager = sagsForDay(day)
            return (
              <div key={day} style={{ minHeight: 70, background: isToday ? '#f0f4f8' : 'transparent', borderRadius: 8, padding: 6, border: isToday ? '2px solid var(--pr)' : '.5px solid var(--brd)' }}>
                <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--pr)' : 'var(--txt)', marginBottom: 4 }}>{day}</div>
                {daySager.map(s => (
                  <div key={s.id} onClick={() => navigate(`/sager/${s.id}`)}
                    style={{ fontSize: 10, fontWeight: 600, padding: '2px 5px', borderRadius: 4, marginBottom: 2, cursor: 'pointer', background: statusColor(s.status), color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.tidspunkt?.slice(0,5)} {s.kunder?.navn || s.adresse?.split(',')[0]}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* LISTE OVER KOMMENDE SAGER */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="section-hd">Kommende sager</div>
        {sager.filter(s => s.dato >= today.toISOString().split('T')[0]).length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Ingen kommende sager</div>
        ) : sager.filter(s => s.dato >= today.toISOString().split('T')[0]).map(s => (
          <div key={s.id} onClick={() => navigate(`/sager/${s.id}`)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, marginBottom: 6, cursor: 'pointer' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor(s.status), flexShrink: 0 }}></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 13 }}>{s.kunder?.navn || 'Ukendt'} – {s.adresse}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(s.dato).toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })} · kl. {s.tidspunkt?.slice(0,5) || '—'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
