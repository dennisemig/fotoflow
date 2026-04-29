import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast, ToastContainer } from '../hooks/useToast'

const TYPES = ['ejendom', 'portræt', 'bryllup', 'event', 'mode', 'produkt']

export default function Sager() {
  const [sager, setSager] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const navigate = useNavigate()
  const { toasts, toast } = useToast()

  useEffect(() => { fetchSager() }, [])

  async function fetchSager() {
    setLoading(true)
    const { data, error } = await supabase
      .from('sager')
      .select('*, kunder(navn), profiles(full_name)')
      .order('created_at', { ascending: false })
    if (error) console.error('Fejl:', error)
    setSager(data || [])
    setLoading(false)
  }

  const filtered = sager.filter(s =>
    (s.kunder?.navn || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.adresse || '').toLowerCase().includes(search.toLowerCase())
  )

  const badgeClass = s => ({ aktiv:'active', afventer:'pending', leveret:'leveret', ny:'new', afsluttet:'done' }[s] || 'new')
  const statusLabel = s => ({ ny:'Ny', aktiv:'Aktiv', afventer:'Afventer', afsluttet:'Afsluttet', leveret:'Leveret' }[s] || 'Ny')

  return (
    <div>
      <ToastContainer toasts={toasts} />
      <div className="page-title">Sager</div>
      <div className="toolbar">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Søg på kunde eller adresse..." />
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ Opret sag</button>
      </div>
      <div className="card">
        {loading ? <div style={{padding:32,textAlign:'center',color:'var(--muted)'}}>Indlæser...</div>
        : filtered.length === 0 ? <div className="empty-state"><div className="empty-icon">📋</div>Ingen sager endnu!</div>
        : <div style={{overflowX:'auto'}}><table>
            <thead><tr><th>Kunde</th><th>Adresse</th><th>Dato</th><th>Type</th><th>Freelancer</th><th>Status</th><th>Handling</th></tr></thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} onClick={() => navigate(`/sager/${s.id}`)}>
                  <td><b>{s.kunder?.navn || '—'}</b></td>
                  <td>{s.adresse || '—'}</td>
                  <td>{s.dato ? new Date(s.dato).toLocaleDateString('da-DK') : '—'}</td>
                  <td>{s.type || '—'}</td>
                  <td>{s.profiles?.full_name || <span style={{color:'var(--muted)',fontSize:12}}>Ingen</span>}</td>
                  <td><span className={`badge badge-${badgeClass(s.status)}`}>{statusLabel(s.status)}</span></td>
                  <td onClick={e=>e.stopPropagation()}><button cla
