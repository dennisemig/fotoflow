import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast, ToastContainer } from '../hooks/useToast'

export default function SagDetalje() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [sag, setSag] = useState(null)
  const [noter, setNoter] = useState('')
  const [saving, setSaving] = useState(false)
  const [freelancere, setFreelancere] = useState([])
  const [showBookModal, setShowBookModal] = useState(false)
  const { toasts, toast } = useToast()

  useEffect(() => { fetchSag(); fetchFreelancere() }, [id])

  async function fetchSag() {
    const { data } = await supabase.from('sager').select('*, kunder(*), profiles(*)').eq('id', id).single()
    setSag(data); setNoter(data?.noter || '')
  }
  async function fetchFreelancere() {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'freelancer')
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
    setSag(s => ({ ...s, freelancer_id: fId, profiles: fl }))
    setShowBookModal(false)
    toast(`✓ ${fl?.full_name} booket på sagen`)
    await fetch('/api/send-notification', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'freelancer_booking', mægler: { email: fl?.email, adresse: sag?.adresse, dato: sag?.dato ? new Date(sag.dato).toLocaleDateString('da-DK') : '', tidspunkt: sag?.tidspunkt || '' } })
    }).catch(() => {})
  }
  async function fjernFreelancer() {
    await supabase.from('sager').update({ freelancer_id: null }).eq('id', id)
    setSag(s => ({ ...s, freelancer_id: null, profiles: null }))
    toast('Freelancer fjernet fra sagen')
  }

  if (!sag) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Indlæser sag...</div>

  const statusLabel = s => ({ ny: 'Ny', aktiv: 'Aktiv', afventer: 'Afventer', afsluttet: 'Afsluttet', leveret: 'Leveret' }[s] || 'Ny')
  const badgeClass = s => s === 'aktiv' ? 'active' : s === 'afventer' ? 'pending' : s === 'ny' ? 'new' : 'done'
  const initials = n => n?.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase() || '?'

  return (
    <div>
      <ToastContainer toasts={toasts} />
      <div className="back-link" onClick={() => navigate('/sager')}>← Tilbage til sager</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div className="page-title" style={{ margin: 0 }}>{sag.adresse}</div>
        <span className={`badge badge-${badgeClass(sag.status)}`}>{statusLabel(sag.status)}</span>
      </div>

      <div className="grid2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* KUNDEINFO */}
          <div className="card">
            <div className="section-hd">Kundeinfo</div>
            {sag.kunder ? (
              <>
                <div style={{ marginBottom: 8 }}><div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Navn</div><div style={{ fontWeight: 600 }}>{sag.kunder.navn}</div></div>
                <div style={{ marginBottom: 8 }}><div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Telefon</div><div>{sag.kunder.telefon || '—'}</div></div>
                <div><div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Email</div><div style={{ color: 'var(--pr)' }}>{sag.kunder.email || '—'}</div></div>
                <button className="btn btn-outline btn-sm" style={{ marginTop: 10 }} onClick={() => navigate(`/kunder/${sag.kunde_id}`)}>Se kundeprofil →</button>
              </>
            ) : <div style={{ color: 'var(--muted)', fontSize: 13 }}>Ingen kunde tilknyttet</div>}
          </div>

          {/* BBR */}
          {sag.bbr_data && (
            <div className="card">
              <div className="section-hd">Ejendomsdata (BBR)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {[{ icon: '📐', val: sag.bbr_data.boligareal ? `${sag.bbr_data.boligareal} m²` : '—', lbl: 'Boligareal' },
                  { icon: '🌿', val: sag.bbr_data.grundareal ? `${sag.bbr_data.grundareal} m²` : '—', lbl: 'Grundstørrelse' },
                  { icon: '🏠', val: sag.bbr_data.etager ? `${sag.bbr_data.etager} plan` : '—', lbl: 'Etager' }
                ].map((b, i) => (
                  <div key={i} style={{ textAlign: 'center', background: 'var(--bg)', borderRadius: 8, padding: 12, border: '.5px solid var(--brd)' }}>
                    <div style={{ fontSize: 20 }}>{b.icon}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--pr)', marginTop: 4 }}>{b.val}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{b.lbl}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DETALJER */}
          <div className="card">
            <div className="section-hd">Sagsdetaljer</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              {[{ lbl: 'Dato', val: sag.dato ? new Date(sag.dato).toLocaleDateString('da-DK') : '—' },
                { lbl: 'Tidspunkt', val: sag.tidspunkt || '—' },
                { lbl: 'Type', val: sag.type || '—' },
                { lbl: 'Maks billeder', val: sag.maks_billeder || 20 }
              ].map((r, i) => (
                <div key={i}><div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>{r.lbl}</div><div style={{ fontWeight: 500 }}>{r.val}</div></div>
              ))}
            </div>
            <button className="btn btn-outline btn-sm">📍 Vis på Google Maps</button>
          </div>

          {/* STATUS */}
          <div className="card">
            <div className="section-hd">Opdater status</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['ny', 'aktiv', 'afventer', 'afsluttet', 'leveret'].map(s => (
                <button key={s} onClick={() => updateStatus(s)}
                  className={`btn btn-sm ${sag.status === s ? 'btn-primary' : 'btn-outline'}`}>
                  {statusLabel(s)}
                </button>
              ))}
            </div>
          </div>

          {/* MINDWORKING */}
          <div className="card">
            <div className="section-hd">Mindworking</div>
            <div className="warn-box" style={{ marginBottom: 10 }}>⏳ Afventer API-nøgle fra Mindworking</div>
            <button className="btn btn-sm" style={{ background: '#8fa8bc', color: '#fff', cursor: 'not-allowed', opacity: .6 }} disabled>⚡ Send til Mindworking</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* FREELANCER */}
          <div className="card">
            <div className="section-hd">Tilknyttet freelancer</div>
            {sag.profiles ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, marginBottom: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--pr)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                    {initials(sag.profiles.full_name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{sag.profiles.full_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{sag.profiles.email}</div>
                  </div>
                  <span className="badge badge-active">Booket</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => setShowBookModal(true)}>Skift freelancer</button>
                  <button className="btn btn-red btn-sm" onClick={fjernFreelancer}>Fjern</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 10 }}>Ingen freelancer booket endnu</div>
                <button className="btn btn-primary btn-sm" onClick={() => setShowBookModal(true)}>+ Book freelancer</button>
              </>
            )}
          </div>

          {/* NOTER */}
          <div className="card">
            <div className="section-hd">Noter</div>
            <textarea value={noter} onChange={e => setNoter(e.target.value)}
              style={{ width: '100%', minHeight: 100, padding: 10, border: '1px solid var(--brd)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
              placeholder="Skriv noter til sagen..." />
            <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={saveNoter} disabled={saving}>
              {saving ? 'Gemmer...' : 'Gem noter'}
            </button>
          </div>

          {/* UPLOAD ZONE */}
          <div className="card">
            <div className="section-hd">Billeder og upload</div>
            <div style={{ border: '2px dashed #c5d3dc', borderRadius: 12, padding: 24, textAlign: 'center', cursor: 'pointer' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}><strong style={{ color: 'var(--pr)' }}>Træk og slip råfiler</strong><br /><span style={{ fontSize: 12 }}>Eller klik for HDR-sorteringsværktøj</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* BOOK FREELANCER MODAL */}
      {showBookModal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowBookModal(false)}>
          <div className="modal">
            <div className="modal-title">Book freelancer på sag<button className="modal-close" onClick={() => setShowBookModal(false)}>✕</button></div>
            {freelancere.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">📷</div>Ingen freelancere – tilføj en først under Freelancere</div>
            ) : freelancere.map(f => (
              <div key={f.id} onClick={() => bookFreelancer(f.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, border: '.5px solid var(--brd)', borderRadius: 10, marginBottom: 8, cursor: 'pointer', transition: 'border-color .15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--pr)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--brd)'}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--pr)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{initials(f.full_name)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{f.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{f.email} · {(f.specialer || []).join(', ')}</div>
                </div>
                <div style={{ color: 'var(--pr)', fontWeight: 600, fontSize: 13 }}>Book →</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
