import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast, ToastContainer } from '../hooks/useToast'

export default function FreelancerProfil() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [freelancer, setFreelancer] = useState(null)
  const [sager, setSager] = useState([])
  const { toasts, toast } = useToast()

  useEffect(() => {
    supabase.from('freelancere').select('*').eq('id', id).single().then(({ data }) => setFreelancer(data))
    supabase.from('sager').select('id, adresse, dato, status').eq('freelancer_id', id).order('dato', { ascending: false }).then(({ data }) => setSager(data || []))
  }, [id])

  async function savePerms(perms) {
    await supabase.from('freelancere').update(perms).eq('id', id)
    setFreelancer(f => ({ ...f, ...perms }))
    toast('✓ Rettigheder gemt')
  }

  async function deaktiver() {
    await supabase.from('freelancere').update({ aktiv: false }).eq('id', id)
    setFreelancer(f => ({ ...f, aktiv: false }))
    toast('Freelancer deaktiveret')
  }

  if (!freelancer) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Indlæser...</div>

  const initials = n => n?.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase() || '?'
  const statusLabel = s => ({ ny: 'Ny', aktiv: 'Aktiv', afventer: 'Afventer', afsluttet: 'Afsluttet', leveret: 'Leveret' }[s] || 'Ny')
  const badgeClass = s => ({ aktiv: 'active', afventer: 'pending', ny: 'new', afsluttet: 'done', leveret: 'leveret' }[s] || 'new')

  const permRows = [
    { key: 'kan_uploade', lbl: 'Upload råfiler', sub: 'Kan uploade til tildelte sager' },
    { key: 'kan_se_sagsdetaljer', lbl: 'Se sagsdetaljer', sub: 'Adresse, kunde, tidspunkt' },
    { key: 'kan_se_alle_sager', lbl: 'Se alle sager', sub: 'Ikke kun egne sager' },
    { key: 'kan_redigere_sager', lbl: 'Redigere sager', sub: 'Ændre status og noter' },
    { key: 'kan_se_crm', lbl: 'CRM-adgang', sub: 'Kan se kundeoplysninger' },
  ]

  return (
    <div>
      <ToastContainer toasts={toasts} />
      <div className="back-link" onClick={() => navigate('/freelancere')}>← Tilbage til freelancere</div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--pr)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700 }}>{initials(freelancer.navn)}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--pr)' }}>{freelancer.navn}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{freelancer.email} · {freelancer.telefon || 'Ingen tlf.'}</div>
            <div style={{ marginTop: 6 }}>{(freelancer.specialer || []).map(s => <span key={s} className="tag">{s}</span>)}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <span className={`badge ${freelancer.aktiv !== false ? 'badge-active' : 'badge-new'}`}>{freelancer.aktiv !== false ? 'Aktiv' : 'Deaktiveret'}</span>
            {freelancer.aktiv !== false && <button className="btn btn-red btn-sm" onClick={deaktiver}>Deaktiver</button>}
          </div>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="section-hd">Bookede sager ({sager.length})</div>
          {sager.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>Ingen sager booket endnu</div>
            : sager.map(s => (
              <div key={s.id} onClick={() => navigate(`/sager/${s.id}`)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '.5px solid var(--brd)', cursor: 'pointer' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{s.adresse}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.dato ? new Date(s.dato).toLocaleDateString('da-DK') : '—'}</div>
                </div>
                <span className={`badge badge-${badgeClass(s.status)}`}>{statusLabel(s.status)}</span>
              </div>
            ))
          }
        </div>

        <div className="card">
          <div className="section-hd">Adgangsrettigheder</div>
          <div className="info-box" style={{ marginBottom: 14 }}>{freelancer.navn} kan logge ind og se/uploade på tildelte sager.</div>
          {permRows.map(r => (
            <div key={r.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '.5px solid var(--brd)' }}>
              <div><div style={{ fontWeight: 500, fontSize: 13 }}>{r.lbl}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.sub}</div></div>
              <label className="toggle">
                <input type="checkbox" checked={!!freelancer[r.key]} onChange={e => { const upd = { [r.key]: e.target.checked }; setFreelancer(f => ({ ...f, ...upd })) }} />
                <span className="tslider"></span>
              </label>
            </div>
          ))}
          <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} onClick={() => savePerms(Object.fromEntries(permRows.map(r => [r.key, freelancer[r.key]])))}>Gem rettigheder</button>
        </div>
      </div>
    </div>
  )
}
