import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const [stats, setStats] = useState({ sager: 0, km: 0, kommende: 0, freelancere: 0 })
  const [tasks, setTasks] = useState([])
  const [reminders, setReminders] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    fetchStats()
    fetchTasks()
  }, [])

  async function fetchStats() {
    const today = new Date().toISOString().split('T')[0]
    const { count: sagerToday } = await supabase.from('sager').select('*', { count: 'exact', head: true }).eq('dato', today)
    const { count: kommende } = await supabase.from('sager').select('*', { count: 'exact', head: true }).gte('dato', today)
    const { count: freelancere } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'freelancer')
    setStats({ sager: sagerToday || 0, km: 42, kommende: kommende || 0, freelancere: freelancere || 0 })
  }

  async function fetchTasks() {
    const { data } = await supabase.from('todos').select('*, sager(titel, adresse)').eq('done', false).order('prioritet').limit(5)
    setTasks(data || [])
  }

  const today = new Date()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay() || 7
  const monthName = today.toLocaleString('da-DK', { month: 'long', year: 'numeric' })

  return (
    <div>
      <div className="page-title">Dashboard</div>

      {/* STAT CARDS */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Sager i dag', value: stats.sager, sub: 'Dagens opgaver', color: 'var(--pr)' },
          { label: 'Kørsel i dag', value: `${stats.km} km`, sub: 'Beregnet rute', color: 'var(--pr)' },
          { label: 'Kommende sager', value: stats.kommende, sub: 'Næste 7 dage', color: 'var(--pr)' },
          { label: 'Freelancere', value: stats.freelancere, sub: 'Aktive fotografer', color: 'var(--blu)', onClick: () => navigate('/freelancere') },
        ].map((s, i) => (
          <div key={i} className="card" style={{ cursor: s.onClick ? 'pointer' : 'default' }} onClick={s.onClick}>
            <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        {/* DAGENS OPGAVER */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="section-hd">Dagens opgaver</div>
            {tasks.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 13, padding: '8px 0' }}>Ingen opgaver i dag 🎉</div>
            ) : tasks.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid var(--brd)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.prioritet === 'high' ? 'var(--red)' : t.prioritet === 'med' ? 'var(--gold)' : 'var(--grn)', flexShrink: 0 }}></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{t.tekst}</div>
                  {t.sager && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t.sager.adresse}</div>}
                </div>
                <span className={`badge badge-${t.status || 'pending'}`}>{t.status || 'Afventer'}</span>
              </div>
            ))}
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/sager/ny')}>+ Opret sag</button>
            </div>
          </div>

          <div className="card">
            <div className="section-hd">Seneste uploads</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6, marginTop: 10 }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{ aspectRatio: 1, background: `hsl(${200 + i * 15},30%,75%)`, borderRadius: 6 }}></div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Klik Upload i menuen for at se alle filer</div>
          </div>
        </div>

        {/* MINI KALENDER */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, fontWeight: 600, fontSize: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--pr)' }}>‹</div>
            <div style={{ textTransform: 'capitalize' }}>{monthName}</div>
            <div style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--pr)' }}>›</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
            {['Ma','Ti','On','To','Fr','Lø','Sø'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', fontWeight: 600, padding: '4px 0' }}>{d}</div>
            ))}
            {[...Array(firstDay - 1)].map((_, i) => <div key={`e${i}`}></div>)}
            {[...Array(daysInMonth)].map((_, i) => {
              const day = i + 1
              const isToday = day === today.getDate()
              return (
                <div key={day} style={{
                  textAlign: 'center', padding: '6px 2px', borderRadius: 5, fontSize: 12,
                  cursor: 'pointer', fontWeight: isToday ? 700 : 400,
                  background: isToday ? 'var(--pr)' : 'transparent',
                  color: isToday ? '#fff' : 'var(--txt)',
                }}>
                  {day}
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Påmindelser</div>
            <div style={{ fontSize: 13, padding: '6px 0', borderBottom: '0.5px solid var(--brd)' }}>📌 Følg op på seneste levering</div>
            <div style={{ fontSize: 13, padding: '6px 0' }}>📌 Tjek Mindworking-ordrer</div>
          </div>
        </div>
      </div>
    </div>
  )
}
