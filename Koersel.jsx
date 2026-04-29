import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const KM_TAKST = 3.79

export default function Koersel() {
  const [sager, setSager] = useState([])
  const [fra, setFra] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0])
  const [til, setTil] = useState(new Date().toISOString().split('T')[0])
  const [tab, setTab] = useState('self')
  const [freelancere, setFreelancere] = useState([])

  useEffect(() => { fetchData() }, [fra, til])

  async function fetchData() {
    const { data } = await supabase.from('sager').select('*, kunder(navn), profiles(full_name)').gte('dato', fra).lte('dato', til).not('km_distance', 'is', null).order('dato', { ascending: false })
    setSager(data || [])
    const { data: fl } = await supabase.from('profiles').select('id, full_name').eq('role', 'freelancer')
    setFreelancere(fl || [])
  }

  const totalKm = sager.filter(s => !s.freelancer_id).reduce((a, s) => a + (s.km_distance || 0), 0)
  const fradrag = (totalKm * KM_TAKST).toFixed(0)

  const setPeriode = v => {
    const now = new Date()
    if (v === 'denne-maaned') { setFra(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]); setTil(now.toISOString().split('T')[0]) }
    else if (v === 'sidste-maaned') { setFra(new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString().split('T')[0]); setTil(new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]) }
    else if (v === 'dette-kvartal') { setFra(new Date(now.getFullYear(), Math.floor(now.getMonth()/3)*3, 1).toISOString().split('T')[0]); setTil(now.toISOString().split('T')[0]) }
    else if (v === 'dette-aar') { setFra(new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]); setTil(now.toISOString().split('T')[0]) }
  }

  return (
    <div>
      <div className="page-title">Kørselsrapport</div>

      <div style={{ background: 'var(--surf)', borderBottom: '.5px solid var(--brd)', marginBottom: 0 }}>
        <div style={{ display: 'flex' }}>
          {[{ id: 'self', lbl: 'Min kørsel' }, { id: 'freelancer', lbl: 'Freelancere' }].map(t => (
            <div key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: '11px 18px', fontSize: 13, fontWeight: tab === t.id ? 700 : 500, cursor: 'pointer', color: tab === t.id ? 'var(--pr)' : 'var(--muted)', borderBottom: tab === t.id ? '2.5px solid var(--pr)' : '2.5px solid transparent' }}>
              {t.lbl}
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: 'var(--surf)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '.5px solid var(--brd)', marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>Fra</label>
          <input type="date" value={fra} onChange={e => setFra(e.target.value)} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--brd)', fontSize: 12 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>Til</label>
          <input type="date" value={til} onChange={e => setTil(e.target.value)} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--brd)', fontSize: 12 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>Genvej</label>
          <select onChange={e => setPeriode(e.target.value)} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--brd)', fontSize: 12 }}>
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
          {sager.filter(s => !s.freelancer_id).length === 0 ? (
            <div className="card">
              <div className="empty-state"><div className="empty-icon">🚗</div>Ingen kørselsdata i denne periode.<br /><span style={{ fontSize: 12 }}>Km beregnes automatisk når du opretter sager med adresser.</span></div>
            </div>
          ) : (
            <>
              <div className="grid4" style={{ marginBottom: 16 }}>
                {[
                  { lbl: 'Samlet kørsel', val: `${totalKm.toFixed(0)} km` },
                  { lbl: 'Antal sager', val: sager.filter(s => !s.freelancer_id).length },
                  { lbl: 'Km-takst 2026', val: `${KM_TAKST} kr/km` },
                  { lbl: 'Skattefradrag', val: `${Number(fradrag).toLocaleString('da-DK')} kr`, green: true },
                ].map((s, i) => (
                  <div key={i} className="card">
                    <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{s.lbl}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: s.green ? 'var(--grn)' : 'var(--pr)' }}>{s.val}</div>
                  </div>
                ))}
              </div>
              <div className="card">
                <div className="section-hd">Kørsel pr. sag</div>
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead><tr><th>Dato</th><th>Kunde</th><th>Adresse</th><th>Km</th><th>Fradrag</th></tr></thead>
                    <tbody>
                      {sager.filter(s => !s.freelancer_id).map(s => (
                        <tr key={s.id}>
                          <td>{s.dato ? new Date(s.dato).toLocaleDateString('da-DK') : '—'}</td>
                          <td><b>{s.kunder?.navn || '—'}</b></td>
                          <td>{s.adresse}</td>
                          <td>{s.km_distance || '—'} km</td>
                          <td style={{ color: 'var(--grn)', fontWeight: 600 }}>{s.km_distance ? `${(s.km_distance * KM_TAKST).toFixed(0)} kr` : '—'}</td>
                        </tr>
                      ))}
                      <tr style={{ fontWeight: 700, color: 'var(--pr)', background: '#f5f7f9', borderTop: '1.5px solid var(--brd)' }}>
                        <td colSpan={3}><b>Total</b></td>
                        <td><b>{totalKm.toFixed(0)} km</b></td>
                        <td style={{ color: 'var(--grn)' }}><b>{Number(fradrag).toLocaleString('da-DK')} kr</b></td>
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
            <div className="empty-state"><div className="empty-icon">📷</div>Ingen freelancere endnu</div>
          ) : (
            <table>
              <thead><tr><th>Freelancer</th><th>Sager</th><th>Km i alt</th><th>Fradrag (est.)</th></tr></thead>
              <tbody>
                {freelancere.map(f => {
                  const fSager = sager.filter(s => s.freelancer_id === f.id)
                  const fKm = fSager.reduce((a, s) => a + (s.km_distance || 0), 0)
                  return (
                    <tr key={f.id}>
                      <td><b>{f.full_name}</b></td>
                      <td>{fSager.length} sager</td>
                      <td>{fKm.toFixed(0)} km</td>
                      <td style={{ color: 'var(--grn)', fontWeight: 600 }}>{(fKm * KM_TAKST).toFixed(0)} kr</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          <div className="info-box" style={{ marginTop: 14 }}>Freelancere kan selv trække deres kørselsrapport når de logger ind.</div>
        </div>
      )}
    </div>
  )
}
