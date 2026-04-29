import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function SagDetaljeComponent() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [sag, setSag] = useState(null)
  const [noter, setNoter] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchSag() }, [id])

  async function fetchSag() {
    const { data } = await supabase
      .from('sager')
      .select('*, kunder(*), profiles(*)')
      .eq('id', id)
      .single()
    setSag(data)
    setNoter(data?.noter || '')
  }

  async function saveNoter() {
    setSaving(true)
    await supabase.from('sager').update({ noter }).eq('id', id)
    setSaving(false)
  }

  async function updateStatus(status) {
    await supabase.from('sager').update({ status }).eq('id', id)
    setSag(s => ({ ...s, status }))
  }

  if (!sag) return <div style={{ padding: 20, color: 'var(--muted)' }}>Indlæser sag...</div>

  return (
    <div>
      <div className="page-title" style={{ cursor: 'pointer', fontSize: 14, fontWeight: 500, color: 'var(--muted)', marginBottom: 8 }} onClick={() => navigate('/sager')}>← Tilbage til sager</div>
      <div className="page-title" style={{ marginBottom: 8 }}>Sag – {sag.adresse}</div>
      <div style={{ marginBottom: 20 }}>
        <span className={`badge badge-${sag.status === 'aktiv' ? 'active' : sag.status === 'afventer' ? 'pending' : 'done'}`}>{sag.status || 'ny'}</span>
      </div>

      <div className="grid-2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* KUNDEINFO */}
          <div className="card">
            <div className="section-hd">Kundeinfo</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div><div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Navn</div><div style={{ fontWeight: 600 }}>{sag.kunder?.navn || '—'}</div></div>
              <div><div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Telefon</div><div>{sag.kunder?.telefon || '—'}</div></div>
              <div><div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</div><div style={{ color: 'var(--pr)' }}>{sag.kunder?.email || '—'}</div></div>
            </div>
          </div>

          {/* BBR DATA */}
          {sag.bbr_data && (
            <div className="card">
              <div className="section-hd">Ejendomsdata (BBR)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {[
                  { icon: '📐', val: `${sag.bbr_data.boligareal || '—'} m²`, lbl: 'Boligareal' },
                  { icon: '🌿', val: `${sag.bbr_data.grundareal || '—'} m²`, lbl: 'Grundstørrelse' },
                  { icon: '🏠', val: `${sag.bbr_data.etager || '—'} plan`, lbl: 'Etager' },
                ].map((b, i) => (
                  <div key={i} style={{ textAlign: 'center', background: 'var(--bg)', borderRadius: 8, padding: 12, border: '0.5px solid var(--brd)' }}>
                    <div style={{ fontSize: 20 }}>{b.icon}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--pr)', lineHeight: 1.2, marginTop: 4 }}>{b.val}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{b.lbl}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STATUS */}
          <div className="card">
            <div className="section-hd">Adresse og kørsel</div>
            <div style={{ marginBottom: 8 }}>{sag.adresse}</div>
            <button className="btn btn-outline btn-sm">📍 Vis på kort</button>
          </div>

          <div className="card">
            <div className="section-hd">Status</div>
            <select value={sag.status || 'ny'} onChange={e => updateStatus(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--brd)', fontSize: 13 }}>
              <option value="ny">Ny</option>
              <option value="aktiv">Aktiv</option>
              <option value="afventer">Afventer</option>
              <option value="afsluttet">Afsluttet</option>
              <option value="leveret">Leveret</option>
            </select>
          </div>

          <div className="card">
            <div className="section-hd">Mindworking</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>Integration konfigureres under Indstillinger.</div>
            <button className="btn btn-sm" style={{ background: '#8fa8bc', color: '#fff', cursor: 'not-allowed', opacity: 0.6 }} disabled>⚡ Synk med Mindworking</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* UPLOAD */}
          <div className="card">
            <div className="section-hd">Billeder</div>
            <div style={{ border: '2px dashed #c5d3dc', borderRadius: 14, padding: 24, textAlign: 'center', cursor: 'pointer' }}
              onClick={() => navigate('/upload')}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
              <div style={{ fontSize: 14, color: 'var(--muted)' }}><strong style={{ color: 'var(--pr)' }}>Gå til upload</strong><br /><span style={{ fontSize: 12 }}>Sorter HDR-stacks og upload til Dropbox</span></div>
            </div>
          </div>

          {/* FREELANCER */}
          <div className="card">
            <div className="section-hd">Tilknyttet freelancer</div>
            {sag.profiles ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, background: 'var(--bg)', borderRadius: 8, marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--pr)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  {sag.profiles.full_name?.split(' ').map(n => n[0]).join('').slice(0,2)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{sag.profiles.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{sag.profiles.email}</div>
                </div>
                <span className="badge badge-active">Booket</span>
              </div>
            ) : (
              <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 10 }}>Ingen freelancer booket</div>
            )}
            <button className="btn btn-outline btn-sm">Book freelancer</button>
          </div>

          {/* NOTER */}
          <div className="card">
            <div className="section-hd">Noter</div>
            <textarea value={noter} onChange={e => setNoter(e.target.value)}
              style={{ width: '100%', minHeight: 80, padding: 10, border: '1px solid var(--brd)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
              placeholder="Skriv noter til sagen..." />
            <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={saveNoter} disabled={saving}>
              {saving ? 'Gemmer...' : 'Gem noter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
