import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast, ToastContainer } from '../hooks/useToast'

export default function SagDetalje() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [sag, setSag] = useState(null)
  const [kunde, setKunde] = useState(null)
  const [freelancer, setFreelancer] = useState(null)
  const [freelancere, setFreelancere] = useState([])
  const [noter, setNoter] = useState('')
  const [saving, setSaving] = useState(false)
  const [showBookModal, setShowBookModal] = useState(false)
  const { toasts, toast } = useToast()

  useEffect(() => { fetchSag(); fetchFreelancere() }, [id])

  async function fetchSag() {
    const { data } = await supabase.from('sager').select('*').eq('id', id).single()
    if (!data) return
    setSag(data); setNoter(data.noter || '')
    if (data.kunde_id) {
      const { data: k } = await supabase.from('kunder').select('*').eq('id', data.kunde_id).single()
      setKunde(k)
    }
    if (data.freelancer_id) {
      const { data: f } = await supabase.from('freelancere').select('*').eq('id', data.freelancer_id).single()
      setFreelancer(f)
    }
  }

  async function fetchFreelancere() {
    const { data } = await supabase.from('freelancere').select('id, navn, email').eq('aktiv', true)
    setFreelancere(data || [])
  }

  async function saveNoter() {
    setSaving(true)
    await supabase.from('sager').update({ noter }).eq('id', id)
    setSaving(false); toast('✓ Noter gemt')
  }

  async function updateStatus(status) {
    await supabase.from('sager').update({ status }).eq('id', id)
    setSag(s => ({ ...s, status })); toast('✓ Status opdateret')
  }

  async function bookFreelancer(fId) {
    const fl = freelancere.find(f => f.id === fId)
    await supabase.from('sager').update({ freelancer_id: fId }).eq('id', id)
    setFreelancer(fl); setSag(s => ({ ...s, freelancer_id: fId }))
    setShowBookModal(false); toast(`✓ ${fl?.navn} booket!`)
    await fetch('/api/send-notification', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'freelancer_booking', mægler: { email: fl?.email, navn: fl?.navn, adresse: sag?.adresse, dato: sag?.dato ? new Date(sag.dato).toLocaleDateString('da-DK') : '', tidspunkt: '' } })
    }).catch(() => {})
  }

  async function fjernFreelancer() {
    await supabase.from('sager').update({ freelancer_id: null }).eq('id', id)
    setFreelancer(null); setSag(s => ({ ...s, freelancer_id: null }))
    toast('Freelancer fjernet')
  }

  if (!sag) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Indlæser...</div>

  const statusLabel = s => ({ ny: 'Ny', aktiv: 'Aktiv', afventer: 'Afventer', afsluttet: 'Afsluttet', leveret: 'Leveret' }[s] || 'Ny')
  const badgeClass = s => ({ aktiv: 'active', afventer: 'pending', leveret: 'leveret', ny: 'new', afsluttet: 'done' }[s] || 'new')
  const initials = n => n?.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase() || '?'

  return (
    <div>
      <ToastContainer toasts={toasts} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
  <div className="back-link" style={{ margin: 0 }} onClick={() => navigate('/sager')}>← Tilbage til sager</div>
  <button className="btn btn-red btn-sm" onClick={async () => {
    if (!confirm('Slet denne sag? Dette kan ikke fortrydes.')) return
    await supabase.from('sager').delete().eq('id', id)
    navigate('/sager')
  }}>🗑 Slet sag</button>
</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div className="page-title" style={{ margin: 0 }}>{sag.adresse}</div>
        <span className={`badge badge-${badgeClass(sag.status)}`}>{statusLabel(sag.status)}</span>
      </div>

      <div className="grid2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="section-hd">Sagsdetaljer</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              {[
                { lbl: 'Dato', val: sag.dato ? new Date(sag.dato).toLocaleDateString('da-DK') : '—' },
                { lbl: 'Tidspunkt', val: sag.tidspunkt ? String(sag.tidspunkt).slice(0, 5) : '—' },
                { lbl: 'Type', val: sag.type || '—' },
                { lbl: 'Maks billeder', val: sag.maks_billeder || 20 },
              ].map((r, i) => (
                <div key={i}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>{r.lbl}</div>
                  <div style={{ fontWeight: 500, textTransform: 'capitalize' }}>{r.val}</div>
                </div>
              ))}
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => window.open(`https://maps.google.com?q=${encodeURIComponent(sag.adresse)}`)}>📍 Vis på Google Maps</button>
          </div>

          {kunde && (
            <div className="card">
              <div className="section-hd">Kundeinfo</div>
              <div style={{ marginBottom: 6 }}><div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Navn</div><div style={{ fontWeight: 600 }}>{kunde.navn}</div></div>
              <div style={{ marginBottom: 6 }}><div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Telefon</div><div>{kunde.telefon || '—'}</div></div>
              <div style={{ marginBottom: 10 }}><div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Email</div><div style={{ color: 'var(--pr)' }}>{kunde.email || '—'}</div></div>
              <button className="btn btn-outline btn-sm" onClick={() => navigate(`/kunder/${kunde.id}`)}>Se kundeprofil →</button>
            </div>
          )}

          <div className="card">
            <div className="section-hd">Opdater status</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['ny', 'aktiv', 'afventer', 'afsluttet', 'leveret'].map(s => (
                <button key={s} onClick={() => updateStatus(s)} className={`btn btn-sm ${sag.status === s ? 'btn-primary' : 'btn-outline'}`}>
                  {statusLabel(s)}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="section-hd">Mindworking</div>
            <div className="warn-box" style={{ marginBottom: 10 }}>⏳ Afventer API-nøgle fra Mindworking</div>
            <button className="btn btn-sm" style={{ background: '#8fa8bc', color: '#fff', opacity: .6, cursor: 'not-allowed' }} disabled>⚡ Send til Mindworking</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="section-hd">Tilknyttet freelancer</div>
            {freelancer ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, marginBottom: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--pr)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>{initials(freelancer.navn)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{freelancer.navn}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{freelancer.email}</div>
                  </div>
                  <span className="badge badge-active">Booket</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => setShowBookModal(true)}>Skift</button>
                  <button className="btn btn-red btn-sm" onClick={fjernFreelancer}>Fjern</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 10 }}>Ingen freelancer booket</div>
                <button className="btn btn-primary btn-sm" onClick={() => setShowBookModal(true)}>+ Book freelancer</button>
              </>
            )}
          </div>

          <div className="card">
            <div className="section-hd">Noter</div>
            <textarea value={noter} onChange={e => setNoter(e.target.value)}
              style={{ width: '100%', minHeight: 100, padding: 10, border: '1px solid var(--brd)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
              placeholder="Skriv noter til sagen..." />
            <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={saveNoter} disabled={saving}>{saving ? 'Gemmer...' : 'Gem noter'}</button>
          </div>

          {sag.bbr_data && (
            <div className="card">
              <div className="section-hd">Ejendomsdata (BBR)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {[
                  { icon: '📐', val: sag.bbr_data.boligareal ? `${sag.bbr_data.boligareal} m²` : '—', lbl: 'Boligareal' },
                  { icon: '🌿', val: sag.bbr_data.grundareal ? `${sag.bbr_data.grundareal} m²` : '—', lbl: 'Grundareal' },
                  { icon: '🏠', val: sag.bbr_data.etager ? `${sag.bbr_data.etager} plan` : '—', lbl: 'Etager' },
                ].map((b, i) => (
                  <div key={i} style={{ textAlign: 'center', background: 'var(--bg)', borderRadius: 8, padding: 10, border: '.5px solid var(--brd)' }}>
                    <div style={{ fontSize: 18 }}>{b.icon}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--pr)', marginTop: 3 }}>{b.val}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{b.lbl}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showBookModal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowBookModal(false)}>
          <div className="modal">
            <div className="modal-title">Book freelancer<button className="modal-close" onClick={() => setShowBookModal(false)}>✕</button></div>
            {freelancere.length === 0
              ? <div className="empty-state"><div className="empty-icon">📷</div>Ingen freelancere – tilføj en under Freelancere</div>
              : freelancere.map(f => (
                <div key={f.id} onClick={() => bookFreelancer(f.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, border: '.5px solid var(--brd)', borderRadius: 10, marginBottom: 8, cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--pr)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--brd)'}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--pr)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{initials(f.navn)}</div>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{f.navn}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{f.email}</div></div>
                  <div style={{ color: 'var(--pr)', fontWeight: 600 }}>Book →</div>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}
