import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function Freelancere() {
  const [freelancere, setFreelancere] = useState([])
  const [showModal, setShowModal] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.from('profiles').select('*').eq('role', 'freelancer').then(({ data }) => setFreelancere(data || []))
  }, [])

  return (
    <div>
      <div className="page-title">Freelancere</div>
      <div className="toolbar">
        <input placeholder="🔍  Søg freelancere..." style={{ flex: 1, maxWidth: 280, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--brd)', fontSize: 13 }} />
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ Tilføj freelancer</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {freelancere.map(f => {
          const initials = f.full_name?.split(' ').map(n => n[0]).join('').slice(0,2) || 'FL'
          return (
            <div key={f.id} onClick={() => navigate(`/freelancere/${f.id}`)}
              style={{ background: 'var(--surf)', borderRadius: 'var(--rad)', border: '0.5px solid var(--brd)', padding: 16, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--pr)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>{initials}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{f.full_name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{f.email}</div>
              </div>
              <span className="badge badge-active">Aktiv</span>
            </div>
          )
        })}
        {freelancere.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Ingen freelancere endnu – klik "+ Tilføj freelancer"</div>}
      </div>
    </div>
  )
}
export default Freelancere
