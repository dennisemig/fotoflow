import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

const KM_TAKST = 3.79

export default function Koersel() {
  const [sager, setSager] = useState([])
  const [freelancere, setFreelancere] = useState([])
  const [fra, setFra] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0])
  const [til, setTil] = useState(new Date().toISOString().split('T')[0])
  const [tab, setTab] = useState('self')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { fetchData() }, [fra, til])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase
      .from('sager')
      .select('id, adresse, dato, status, km_distance, freelancer_id, kunde_id')
      .gte('dato', fra)
      .lte('dato', til)
      .not('km_distance', 'is', null)
      .order('dato', { ascending: false })

    // Hent kundenavne
    const kundeIds = [...new Set((data || []).filter(s => s.kunde_id).map(s => s.kunde_id))]
    let kundeMap = {}
    if (kundeIds.length > 0) {
      const { data: k } = await supabase.from('kunder').select('id, navn').in('id', kundeIds)
      if (k) k.forEach(x => kundeMap[x.id] = x)
    }

    setSager((data || []).map(s => ({ ...s, kunde: kundeMap[s.kunde_id] || null })))

    const { data: fl } = await supabase.from('freelancere').select('id, navn').eq('aktiv', true)
    setFreelancere(fl || [])
    setLoading(false)
  }

  const setPeriode = v => {
    const now = new Date()
    if (v === 'denne-maaned') { setFra(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]); setTil(now.toISOString().split('T')[0]) }
    else if (v === 'sidste-maaned') { setFra(new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString().split('T')[0]); setTil(new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]) }
    else if (v === 'dette-kvartal') { setFra(new Date(now.getFullYear(), Math.floor(now.getMonth()/3)*3, 1).toISOString().split('T')[0]); setTil(now.toISOString().split('T')[0]) }
    else if (v === 'dette-aar') { setFra(new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]); setTil(now.toISOString().split('T')[0]) }
  }

  const mineSager = sager.filter(s => !s.freelancer_id)
  const totalKm = mineSager.reduce((a, s) => a + (parseFloat(s.km_distance) || 0), 0)
  const totalTurRetur = Math.round(totalKm * 2 * 10) / 10
  const fradrag = Math.round(totalTurRetur * KM_TAKST)

  return (
    <div>
      <div className="page-title">Kørselsrapport</div>

      {/* TABS */}
      <div style={{ display: 'flex', background: 'var(--surf)', borderBottom: '.5px solid var(--brd)', marginBottom: 20 }}>
        {[{ id: 'self', lbl: '🚗 Min kørsel' }, { id: 'freelancer', lbl: '📷 Freelancere' }].map(t => (
          <div key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '11px 18px', fontSize: 13, fontWeight: tab === t.id ? 700 : 500, cursor: 'pointer', color: tab === t.id ? 'var(--pr)' : 'var(--muted)', borderBottom: tab === t.id ? '2.5px solid var(--pr)' : '2.5px solid transparent' }}>
            {t.lbl}
          </div>
        ))}
      </div>

      {/* PERIODE FILTER */}
      <div style={{ background: 'var(--surf)', padding: '12px 20px', display: 'flex', alignItems: 'flex-end', gap: 12, borderRadius: 'var(--rad)', border: '.5px solid var(--brd)', marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>Fra</div>
          <input type="date" value={fra} onChange={e => setFra(e.target.value)} style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid var(--brd)', fontSize: 13 }} />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>Til</div>
          <input type="date" value={til} onChange={e => setTil(e.target.value)} style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid var(--brd)', fontSize: 13 }} />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>Genvej</div>
          <select onChange={e => setPeriode(e.target.value)} style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid var(--brd)', fontSize: 13 }}>
            <option value="">Vælg periode...</option>
            <option value="denne-maaned">Denne måned</option>
            <option value="sidste-maaned">Sidste måned</option>
            <option value="dette-kvartal">Dette kvartal</option>
            <option value="dette-aar">Dette år</option>
          </select>
        </div>
        <div style={{ flex: 1 }}></div>
        <button className="btn btn-green btn-sm" onClick={() => window.print()}>⬇ Eksporter PDF</button>
      </div>

      {tab === 'self' && (
        <>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>Indlæser...</div>
          ) : mineSager.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-icon">🚗</div>
                Ingen kørselsdata i denne periode
                <div style={{ fontSize: 12, marginTop: 8 }}>Km beregnes automatisk når du opretter sager. Husk at sætte din startadresse under Indstillinger.</div>
              </div>
            </div>
          ) : (
            <>
              <div className="grid4" style={{ marginBottom: 16 }}>
                {[
                  { lbl: 'Sager i alt', val: mineSager.length, icon: '📋' },
                  { lbl: 'Km enkeltvis', val: `${totalKm.toFixed(1)} km`, icon: '🗺' },
                  { lbl: 'Km tur/retur', val: `${totalTurRetur} km`, icon: '↔' },
                  { lbl: `Skattefradrag (${KM_TAKST} kr/km)`, val: `${fradrag.toLocaleString('da-DK')} kr`, icon: '💰', green: true },
                ].map((s, i) => (
                  <div key={i} className="card">
                    <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{s.lbl}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 20 }}>{s.icon}</span>
                      <div style={{ fontSize: 22, fontWeight: 700, color: s.green ? 'var(--grn)' : 'var(--pr)' }}>{s.val}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="card">
                <div className="section-hd">Kørsel pr. sag</div>
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr><th>Dato</th><th>Adresse</th><th>Kunde</th><th>Km (enkelt)</th><th>Km (tur/retur)</th><th>Fradrag</th></tr>
                    </thead>
                    <tbody>
                      {mineSager.map(s => {
                        const km = parseFloat(s.km_distance) || 0
                        const tr = Math.round(km * 2 * 10) / 10
                        const fr = Math.round(tr * KM_TAKST)
                        return (
                          <tr key={s.id} onClick={() => navigate(`/sager/${s.id}`)} style={{ cursor: 'pointer' }}>
                            <td>{s.dato ? new Date(s.dato + 'T12:00:00').toLocaleDateString('da-DK') : '—'}</td>
                            <td>{s.adresse}</td>
                            <td>{s.kunde?.navn || '—'}</td>
                            <td>{km.toFixed(1)} km</td>
                            <td>{tr} km</td>
                            <td style={{ color: 'var(--grn)', fontWeight: 600 }}>{fr.toLocaleString('da-DK')} kr</td>
                          </tr>
                        )
                      })}
                      <tr style={{ fontWeight: 700, background: '#f5f7f9', borderTop: '1.5px solid var(--brd)' }}>
                        <td colSpan={3}><b>Total</b></td>
                        <td><b>{totalKm.toFixed(1)} km</b></td>
                        <td><b>{totalTurRetur} km</b></td>
                        <td style={{ color: 'var(--grn)' }}><b>{fradrag.toLocaleString('da-DK')} kr</b></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'freelancer' && (
        <div className="card">
          <div className="section-hd">Kørsel pr. freelancer</div>
          {freelancere.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📷</div>Ingen freelancere</div>
          ) : (
            <table>
              <thead><tr><th>Freelancer</th><th>Sager</th><th>Km enkelt</th><th>Km tur/retur</th><th>Fradrag (est.)</th></tr></thead>
              <tbody>
                {freelancere.map(f => {
                  const fSager = sager.filter(s => s.freelancer_id === f.id)
                  const fKm = fSager.reduce((a, s) => a + (parseFloat(s.km_distance) || 0), 0)
                  const fTR = Math.round(fKm * 2 * 10) / 10
                  return (
                    <tr key={f.id}>
                      <td><b>{f.navn}</b></td>
                      <td>{fSager.length} sager</td>
                      <td>{fKm.toFixed(1)} km</td>
                      <td>{fTR} km</td>
                      <td style={{ color: 'var(--grn)', fontWeight: 600 }}>{Math.round(fTR * KM_TAKST).toLocaleString('da-DK')} kr</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          <div className="info-box" style={{ marginTop: 14 }}>Km beregnes automatisk fra din startadresse til sagens adresse.</div>
        </div>
      )}
    </div>
  )
}
