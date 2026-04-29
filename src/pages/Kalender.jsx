import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Kalender() {
  const [sager, setSager] = useState([])
  const navigate = useNavigate()
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = (new Date(year, month, 1).getDay() || 7) - 1
  const monthName = today.toLocaleString('da-DK', { month: 'long', year: 'numeric' })
  const todayStr = today.toISOString().split('T')[0]

  useEffect(() => {
    const from = new Date(year, month, 1).toISOString().split('T')[0]
    const to = new Date(year, month + 1, 0).toISOString().split('T')[0]
    supabase.from('sager').select('id, adresse, dato, status, tidspunkt, kunde_id').gte('dato', from).lte('dato', to).order('dato')
      .then(({ data }) => setSager(data || []))
  }, [])

  const sagsForDay = day => {
    const d = new Date(year, month, day).toISOString().split('T')[0]
    return sager.filter(s => s.dato === d)
  }

  const statusColor = s => ({ aktiv: '#2e7d4f', afventer: '#e5a243', leveret: '#0c447c', ny: '#6b7280', afsluttet: '#6b7280' }[s] || '#6b7280')

  return (
    <div>
      <div className="page-title">Kalender</div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, fontWeight: 600, fontSize: 15 }}>
          <span style={{ cursor: 'pointer', color: 'var(--pr)', padding: '4px 8px' }}>‹</span>
          <span style={{ textTransform: 'capitalize' }}>{monthName}</span>
          <span style={{ cursor: 'pointer', color: 'var(--pr)', padding: '4px 8px' }}>›</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 6 }}>
          {['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', fontWeight: 600, padding: '4px 0' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
          {[...Array(firstDay)].map((_, i) => <div key={`e${i}`} />)}
          {[...Array(daysInMonth)].map((_, i) => {
            const day = i + 1
            const dayStr = new Date(year, month, day).toISOString().split('T')[0]
            const isToday = dayStr === todayStr
            const daySager = sagsForDay(day)
            return (
              <div key={day} style={{ minHeight: 64, background: isToday ? '#f0f4f8' : 'transparent', borderRadius: 7, padding: 5, border: isToday ? '2px solid var(--pr)' : '.5px solid var(--brd)' }}>
                <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--pr)' : 'var(--txt)', marginBottom: 3 }}>{day}</div>
                {daySager.map(s => (
                  <div key={s.id} onClick={() => navigate(`/sager/${s.id}`)}
                    style={{ fontSize: 9, fontWeight: 600, padding: '2px 4px', borderRadius: 3, marginBottom: 2, cursor: 'pointer', background: statusColor(s.status), color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.tidspunkt ? String(s.tidspunkt).slice(0, 5) + ' ' : ''}{s.adresse?.split(',')[0]}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
      <div className="card">
        <div className="section-hd">Kommende sager</div>
        {sager.filter(s => s.dato >= todayStr).length === 0
          ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>Ingen kommende sager denne måned</div>
          : sager.filter(s => s.dato >= todayStr).map(s => (
            <div key={s.id} onClick={() => navigate(`/sager/${s.id}`)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--bg)', borderRadius: 8, marginBottom: 6, cursor: 'pointer' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor(s.status), flexShrink: 0 }}></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{s.adresse}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {new Date(s.dato).toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })}
                  {s.tidspunkt ? ` · kl. ${String(s.tidspunkt).slice(0, 5)}` : ''}
                </div>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  )
}
