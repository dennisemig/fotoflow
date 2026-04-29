import { useState } from 'react'

export default function Koersel() {
  const [periode, setPeriode] = useState('dette-aar')
  const [fra, setFra] = useState('2026-01-01')
  const [til, setTil] = useState(new Date().toISOString().split('T')[0])
  const [tab, setTab] = useState('self')

  const KM_TAKST = 3.79

  const demoData = [
    { dato: '28. apr', kunde: 'Familie Hansen', adresse: 'Amagerbrogade 12', km: 12, tid: '18 min' },
    { dato: '28. apr', kunde: 'Ejendom A/S', adresse: 'Østerbrogade 44', km: 8, tid: '14 min' },
    { dato: '29. apr', kunde: 'TechFirma ApS', adresse: 'Frederiksberg', km: 22, tid: '31 min' },
    { dato: '22. apr', kunde: 'Modeshow CPH', adresse: 'Kronprinsessegade', km: 9, tid: '16 min' },
    { dato: '15. apr', kunde: 'Bryllup Sørensen', adresse: 'Dragør', km: 31, tid: '44 min' },
  ]
  const totalKm = demoData.reduce((a, r) => a + r.km, 0)
  const fradrag = (totalKm * KM_TAKST).toFixed(0)

  return (
    <div>
      <div className="page-title">Kørselsrapport</div>

      <div style={{ background: 'var(--surf)', borderBottom: '0.5px solid var(--brd)', marginBottom: 0 }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {[{ id: 'self', label: 'Min kørsel' }, { id: 'freelancer', label: 'Freelancere' }, { id: 'settings', label: 'Indstillinger' }].map(t => (
            <div key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: '11px 18px', fontSize: 13, fontWeight: tab === t.id ? 700 : 500, cursor: 'pointer', color: tab === t.id ? 'var(--pr)' : 'var(--muted)', borderBottom: tab === t.id ? '2.5px solid var(--pr)' : '2.5px solid transparent' }}>
              {t.label}
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: 'var(--surf)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '0.5px solid var(--brd)', marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fra dato</label>
          <input type="date" value={fra} onChange={e => setFra(e.target.value)} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--brd)', fontSize: 12 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Til dato</label>
          <input type="date" value={til} onChange={e => setTil(e.target.value)} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--brd)', fontSize: 12 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Periode</label>
          <select value={periode} onChange={e => setPeriode(e.target.value)} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--brd)', fontSize: 12 }}>
            <option value="denne-maaned">Denne måned</option>
            <option value="sidste-maaned">Sidste måned</option>
            <option value="dette-kvartal">Dette kvartal</option>
            <option value="dette-aar">Dette år</option>
            <option value="brugerdefineret">Brugerdefineret</option>
          </select>
        </div>
        <div style={{ flex: 1 }}></div>
        <button className="btn btn-green btn-sm">⬇ Eksporter PDF</button>
        <button className="btn btn-outline btn-sm">⬇ Eksporter CSV</button>
      </div>

      {tab === 'self' && (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            {[
              { label: 'Samlet kørsel', val: `${totalKm} km`, sub: `Gns. ${(totalKm/demoData.length).toFixed(0)} km/sag` },
              { label: 'Sager med kørsel', val: demoData.length, sub: 'I valgt periode' },
              { label: 'Skattefradrag (est.)', val: `${Number(fradrag).toLocaleString('da-DK')} kr`, sub: `${KM_TAKST} kr/km · 2026` },
              { label: 'Samlet køretid', val: '2t 3m', sub: 'Estimeret' },
            ].map((s, i) => (
              <div key={i} className="card">
                <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--pr)' }}>{s.val}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginBottom: 14 }}>
            <div className="section-hd">Kørsel pr. sag</div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr><th>Dato</th><th>Kunde</th><th>Adresse</th><th>Fra</th><th>Km</th><th>Tid</th></tr></thead>
                <tbody>
                  {demoData.map((r, i) => <tr key={i}><td>{r.dato}</td><td><b>{r.kunde}</b></td><td>{r.adresse}</td><td>Hjemme</td><td>{r.km} km</td><td>{r.tid}</td></tr>)}
                  <tr style={{ fontWeight: 700, color: 'var(--pr)', background: '#f5f7f9', borderTop: '1.5px solid var(--brd)' }}>
                    <td colSpan={4}><b>Total · {demoData.length} sager</b></td><td><b>{totalKm} km</b></td><td><b>2t 3m</b></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="section-hd">Skattefradrag</div>
            {[
              { lbl: 'Samlet kørsel', val: `${totalKm} km` },
              { lbl: 'Statens km-takst 2026', val: `${KM_TAKST} kr/km` },
              { lbl: 'Samlet fradragsberettiget beløb', val: `${Number(fradrag).toLocaleString('da-DK')} kr`, bold: true, green: true },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < 2 ? '0.5px solid var(--brd)' : 'none' }}>
                <div style={{ fontWeight: r.bold ? 700 : 400 }}>{r.lbl}</div>
                <div style={{ fontWeight: 700, fontSize: r.green ? 16 : 14, color: r.green ? 'var(--grn)' : 'var(--pr)' }}>{r.val}</div>
              </div>
            ))}
            <div className="info-box" style={{ marginTop: 12 }}>Rapporten kan eksporteres direkte til brug i din årsopgørelse eller til revisor.</div>
          </div>
        </>
      )}

      {tab === 'freelancer' && (
        <div className="card">
          <div className="section-hd">Kørsel pr. freelancer</div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Freelancer</th><th>Sager</th><th>Samlet km</th><th>Fradrag (est.)</th><th>Rapport</th></tr></thead>
              <tbody>
                {[{n:'Lars Pedersen',s:8,km:214},{n:'Sara Nielsen',s:3,km:87},{n:'Mikkel Hansen',s:5,km:156}].map((f,i)=>(
                  <tr key={i}>
                    <td><b>{f.n}</b></td><td>{f.s} sager</td><td>{f.km} km</td>
                    <td style={{color:'var(--grn)',fontWeight:600}}>{(f.km*KM_TAKST).toFixed(0)} kr</td>
                    <td><button className="btn btn-outline btn-sm">Se rapport</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="card" style={{ maxWidth: 480 }}>
          <div className="section-hd">Kørselsindstillinger</div>
          <div className="form-group"><label>Standard startadresse</label><input type="text" placeholder="Din hjemmeadresse..." /></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '0.5px solid var(--brd)' }}>
            <div><div style={{ fontWeight: 500 }}>Beregn km automatisk via Google Maps</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>Henter afstand fra sagens adresse</div></div>
            <label className="toggle"><input type="checkbox" defaultChecked /><span className="tslider"></span></label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
            <div><div style={{ fontWeight: 500 }}>Freelancere kan se egen rapport</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>Freelancere eksporterer egne kørselstimer</div></div>
            <label className="toggle"><input type="checkbox" defaultChecked /><span className="tslider"></span></label>
          </div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }}>Gem indstillinger</button>
        </div>
      )}
    </div>
  )
}
