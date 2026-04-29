import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const [stats, setStats] = useState({ sager: 0, kunder: 0, freelancere: 0, kommende: 0 })
  const [recentSager, setRecentSager] = useState([])
  const [todos, setTodos] = useState([])
  const [newTodo, setNewTodo] = useState('')
  const navigate = useNavigate()
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [
      { count: s }, { count: k }, { count: f }, { count: kom },
      { data: sager }, { data: td }
    ] = await Promise.all([
      supabase.from('sager').select('*', { count: 'exact', head: true }),
      supabase.from('kunder').select('*', { count: 'exact', head: true }),
      supabase.from('freelancere').select('*', { count: 'exact', head: true }).eq('aktiv', true),
      supabase.from('sager').select('*', { count: 'exact', head: true }).gte('dato', today),
      supabase.from('sager').select('id, adresse, dato, status, kunde_id').order('created_at', { ascending: false }).limit(5),
      supabase.from('todos').select('*').eq('done', false).order('created_at', { ascending: false }).limit(8)
    ])
    setStats({ sager: s || 0, kunder: k || 0, freelancere: f || 0, kommende: kom || 0 })
    setRecentSager(sager || [])
    setTodos(td || [])
  }

  async function addTodo(e) {
    e.preventDefault()
    if (!newTodo.trim()) return
    const { data } = await supabase.from('todos').insert([{ tekst: newTodo, prioritet: 'med', type: 'generel', done: false }]).select().single()
    if (data) setTodos(t => [data, ...t])
    setNewTodo('')
  }

  async function toggleTodo(id, done) {
    await supabase.from('todos').update({ done: !done }).eq('id', id)
    setTodos(t => t.map(x => x.id === id ? { ...x, done: !done } : x).filter(x => !x.done))
  }

  const monthName = new Date().toLocaleString('da-DK', { month: 'long', year: 'numeric' })
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const firstDay = (new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay() || 7) - 1
  const todayDate = new Date().getDate()

  const statusColor = s => ({ aktiv: 'var(--grn)', afventer: 'var(--gold)', leveret: 'var(--blu)', ny: 'var(--muted)', afsluttet: 'var(--muted)' }[s] || 'var(--muted)')
  const statusLabel = s => ({ ny: 'Ny', aktiv: 'Aktiv', afventer: 'Afventer', afsluttet: 'Afsluttet', leveret: 'Leveret' }[s] || 'Ny')
  const badgeClass = s => ({ aktiv: 'active', afventer: 'pending', leveret: 'leveret', ny: 'new', afsluttet: 'done' }[s] || 'new')

  return (
    <div>
      <div className="page-title">Dashboard</div>
      <div className="grid4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Sager i alt', val: stats.sager, icon: '📋', click: () => navigate('/sager') },
          { label: 'Kommende sager', val: stats.kommende, icon: '📅', click: () => navigate('/kalender') },
          { label: 'Kunder', val: stats.kunder, icon: '👥', click: () => navigate('/kunder') },
          { label: 'Freelancere', val: stats.freelancere, icon: '📷', click: () => navigate('/freelancere') },
        ].map((s, i) => (
          <div key={i} className="card" style={{ cursor: 'pointer' }} onClick={s.click}>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{s.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 22 }}>{s.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--pr)' }}>{s.val}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="section-hd" style={{ margin: 0 }}>Seneste sager</div>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/sager')}>Se alle</button>
            </div>
            {recentSager.length === 0
              ? <div className="empty-state" style={{ padding: 20 }}><div className="empty-icon">📋</div>Ingen sager endnu</div>
              : recentSager.map(s => (
                <div key={s.id} onClick={() => navigate(`/sager/${s.id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '.5px solid var(--brd)', cursor: 'pointer' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor(s.status), flexShrink: 0 }}></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{s.adresse || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.dato ? new Date(s.dato).toLocaleDateString('da-DK') : '—'}</div>
                  </div>
                  <span className={`badge badge-${badgeClass(s.status)}`}>{statusLabel(s.status)}</span>
                </div>
              ))
            }
            <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => navigate('/sager')}>+ Opret ny sag</button>
          </div>

          <div className="card">
            <div className="section-hd">To-do liste</div>
            <form onSubmit={addTodo} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input value={newTodo} onChange={e => setNewTodo(e.target.value)} placeholder="Tilføj opgave og tryk Enter..."
                style={{ flex: 1, padding: '7px 11px', borderRadius: 8, border: '1px solid var(--brd)', fontSize: 13, fontFamily: 'inherit' }} />
              <button type="submit" className="btn btn-primary btn-sm">+</button>
            </form>
            {todos.filter(t => !t.done).map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '.5px solid var(--brd)' }}>
                <div onClick={() => toggleTodo(t.id, t.done)}
                  style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--brd)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, fontSize: 10, color: '#fff', background: 'transparent' }}>
                </div>
                <div style={{ flex: 1, fontSize: 13 }}>{t.tekst}</div>
                <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: t.prioritet === 'high' ? 'var(--red)' : t.prioritet === 'med' ? 'var(--gold)' : 'var(--grn)' }}></div>
              </div>
            ))}
            {todos.filter(t => !t.done).length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: 12 }}>Ingen opgaver 🎉</div>}
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, fontWeight: 600, fontSize: 14 }}>
            <span style={{ cursor: 'pointer', color: 'var(--pr)' }}>‹</span>
            <span style={{ textTransform: 'capitalize' }}>{monthName}</span>
            <span style={{ cursor: 'pointer', color: 'var(--pr)' }}>›</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
            {['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10, color: 'var(--muted)', fontWeight: 600, padding: '3px 0' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
            {[...Array(firstDay)].map((_, i) => <div key={`e${i}`} />)}
            {[...Array(daysInMonth)].map((_, i) => {
              const day = i + 1
              const isToday = day === todayDate
              return (
                <div key={day} style={{ textAlign: 'center', padding: '6px 2px', borderRadius: 5, fontSize: 12, cursor: 'pointer', fontWeight: isToday ? 700 : 400, background: isToday ? 'var(--pr)' : 'transparent', color: isToday ? '#fff' : 'var(--txt)' }}>
                  {day}
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 16, borderTop: '.5px solid var(--brd)', paddingTop: 14 }}>
            <div className="section-hd">Hurtige genveje</div>
            {[
              { icon: '📋', label: 'Opret ny sag', to: '/sager' },
              { icon: '👥', label: 'Tilføj kunde', to: '/kunder' },
              { icon: '📷', label: 'Tilføj freelancer', to: '/freelancere' },
              { icon: '📦', label: 'Administrer pakker', to: '/pakker' },
            ].map((a, i) => (
              <div key={i} onClick={() => navigate(a.to)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '.5px solid var(--brd)', cursor: 'pointer', fontSize: 13 }}>
                <span>{a.icon}</span><span>{a.label}</span>
                <span style={{ marginLeft: 'auto', color: 'var(--muted)' }}>→</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
