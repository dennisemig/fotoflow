// Kunder.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Kunder() {
  const [kunder, setKunder] = useState([])
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    supabase.from('kunder').select('*').order('navn').then(({ data }) => setKunder(data || []))
  }, [])

  const filtered = kunder.filter(k => k.navn?.toLowerCase().includes(search.toLowerCase()) || k.email?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="page-title">Kunder (CRM)</div>
      <div className="toolbar">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Søg kunder..." />
        <button className="btn btn-primary btn-sm">+ Opret kunde</button>
      </div>
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Navn</th><th>Telefon</th><th>Email</th><th>Tags</th><th>Handling</th></tr></thead>
            <tbody>
              {filtered.map(k => (
                <tr key={k.id} onClick={() => navigate(`/kunder/${k.id}`)}>
                  <td><b>{k.navn}</b></td>
                  <td>{k.telefon || '—'}</td>
                  <td>{k.email || '—'}</td>
                  <td>{(k.tags || []).map(t => <span key={t} style={{ display: 'inline-block', padding: '1px 7px', borderRadius: 20, fontSize: 11, background: '#e8edf1', color: 'var(--pr)', marginRight: 4 }}>{t}</span>)}</td>
                  <td><button className="btn btn-outline btn-sm">Se profil</button></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>Ingen kunder endnu</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
