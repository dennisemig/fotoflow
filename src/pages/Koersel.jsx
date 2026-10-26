import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { gemKmForSag, hentStartadresse, beregnRute } from '../lib/km'

const KM_TAKST = 3.79

// Lokal dato som YYYY-MM-DD. toISOString() giver UTC, og i dansk tid rykker det
// datoen en dag tilbage (fx 1. januar → 31. december), så sager falder uden for perioden.
const lokalDato = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const SIDE = 1000

const rund = km => Math.round(km * 10) / 10
const tidSort = (a, b) => (a.tidspunkt || '99').localeCompare(b.tidspunkt || '99')

// Mine sager grupperet pr. dag i rækkefølge efter tidspunkt
function grupperDage(sager) {
  const dage = {}
  sager.forEach(s => { (dage[s.dato] = dage[s.dato] || []).push(s) })
  return Object.entries(dage)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dato, liste]) => ({ dato, sager: liste.sort(tidSort) }))
}

export default function Koersel() {
  const [sager, setSager] = useState([])
  const [freelancere, setFreelancere] = useState([])
  const [fra, setFra] = useState(lokalDato(new Date(new Date().getFullYear(), 0, 1)))
  const [til, setTil] = useState(lokalDato(new Date()))
  const [tab, setTab] = useState('self')
  const [loading, setLoading] = useState(true)
  const [beregner, setBeregner] = useState(null) // { done, total } mens manglende km beregnes
  const [ruter, setRuter] = useState({}) // dato → km pr. ben for dage med flere sager
  const [beregnerRuter, setBeregnerRuter] = useState(false)
  const hentId = useRef(0)
  const navigate = useNavigate()

  useEffect(() => { fetchData() }, [fra, til])

  async function fetchData() {
    // Kun det seneste kald må opdatere siden, så et langsomt svar for en gammel periode ikke overskriver
    const mitId = ++hentId.current
    const aktuel = () => mitId === hentId.current
    setLoading(true)
    setBeregner(null)
    setRuter({})
    setBeregnerRuter(false)

    // Hent alle sager i perioden, også dem uden km endnu (Supabase giver max 1000 rækker pr. kald)
    let data = []
    for (let side = 0; ; side++) {
      const { data: rows, error } = await supabase
        .from('sager')
        .select('id, adresse, dato, tidspunkt, status, km_distance, freelancer_id, kunde_id')
        .gte('dato', fra)
        .lte('dato', til)
        .order('dato', { ascending: false })
        .order('id')
        .range(side * SIDE, side * SIDE + SIDE - 1)
      if (error) { console.error('Kørsel fejl:', error); break }
      data = data.concat(rows || [])
      if (!rows || rows.length < SIDE) break
    }
    if (!aktuel()) return

    // Hent kundenavne
    const kundeIds = [...new Set(data.filter(s => s.kunde_id).map(s => s.kunde_id))]
    let kundeMap = {}
    if (kundeIds.length > 0) {
      const { data: k } = await supabase.from('kunder').select('id, navn').in('id', kundeIds)
      if (k) k.forEach(x => kundeMap[x.id] = x)
    }

    const { data: fl } = await supabase.from('freelancere').select('id, navn').eq('aktiv', true)
    if (!aktuel()) return
    setSager(data.map(s => ({ ...s, kunde: kundeMap[s.kunde_id] || null })))
    setFreelancere(fl || [])
    setLoading(false)

    // Sager oprettet via booking/kalender (eller hvor beregningen fejlede) har ingen km. Beregn og gem dem nu.
    const mangler = data.filter(s => s.km_distance == null && s.adresse)
    const flereSager = grupperDage(data.filter(s => !s.freelancer_id && s.adresse)).filter(d => d.sager.length > 1)
    if (mangler.length === 0 && flereSager.length === 0) return
    const startadresse = await hentStartadresse()
    if (!startadresse || !aktuel()) return
    if (mangler.length > 0) {
      setBeregner({ done: 0, total: mangler.length })
      for (let i = 0; i < mangler.length; i++) {
        if (!aktuel()) return
        const km = await gemKmForSag(mangler[i].id, mangler[i].adresse, startadresse)
        if (!aktuel()) return
        if (km != null) setSager(prev => prev.map(s => s.id === mangler[i].id ? { ...s, km_distance: km } : s))
        setBeregner({ done: i + 1, total: mangler.length })
      }
      setBeregner(null)
    }

    // Dage med flere sager køres som én rute: hjem → sag 1 → sag 2 → … → hjem
    if (flereSager.length === 0) return
    setBeregnerRuter(true)
    for (const dag of flereSager) {
      const rute = await beregnRute(startadresse, dag.sager.map(s => s.adresse))
      if (!aktuel()) return
      setRuter(prev => ({ ...prev, [dag.dato]: rute }))
    }
    setBeregnerRuter(false)
  }

  const setPeriode = v => {
    const now = new Date()
    if (v === 'denne-maaned') { setFra(lokalDato(new Date(now.getFullYear(), now.getMonth(), 1))); setTil(lokalDato(now)) }
    else if (v === 'sidste-maaned') { setFra(lokalDato(new Date(now.getFullYear(), now.getMonth()-1, 1))); setTil(lokalDato(new Date(now.getFullYear(), now.getMonth(), 0))) }
    else if (v === 'dette-kvartal') { setFra(lokalDato(new Date(now.getFullYear(), Math.floor(now.getMonth()/3)*3, 1))); setTil(lokalDato(now)) }
    else if (v === 'dette-aar') { setFra(lokalDato(new Date(now.getFullYear(), 0, 1))); setTil(lokalDato(now)) }
  }

  const mineSager = sager.filter(s => !s.freelancer_id)
  const manglerKm = mineSager.filter(s => s.km_distance == null)

  // Km pr. sag: ved én sag på dagen tur/retur hjemmefra. Ved flere sager dagens rute,
  // hvor hver sag får strækningen fra forrige stop, og dagens sidste sag også turen hjem.
  // Sager hvis adresse ikke kan findes på kortet regnes som en separat tur hjemmefra (*).
  const dage = grupperDage(mineSager).map(dag => {
    const flere = dag.sager.length > 1
    const rute = flere ? ruter[dag.dato] : null
    const antalMed = rute ? rute.med.filter(Boolean).length : 0
    let j = 0
    const rækker = dag.sager.map((s, i) => {
      if (flere && rute === undefined && beregnerRuter) return { ...s, km: null, venter: true }
      if (rute && rute.med[i]) {
        const først = j === 0, sidst = j === antalMed - 1
        const km = rund(rute.ben[j] + (sidst ? rute.ben[j + 1] : 0))
        j++
        return { ...s, km, strækning: `${først ? 'Hjem' : 'Forrige sag'} → her${sidst ? ' → hjem' : ''}` }
      }
      if (s.km_distance == null) return { ...s, km: null }
      return { ...s, km: rund(parseFloat(s.km_distance) * 2), strækning: flere ? 'Separat tur hjemmefra' : 'Hjem → her → hjem', separat: flere }
    })
    return { ...dag, rækker }
  })
  const rækker = dage.flatMap(d => d.rækker)
  const totalKm = rund(rækker.reduce((a, s) => a + (s.km || 0), 0))
  const fradrag = Math.round(totalKm * KM_TAKST)
  const separateSager = rækker.filter(s => s.separat).length

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

      {beregner && (
        <div className="info-box" style={{ marginBottom: 16 }}>⏳ Beregner km for sager uden kørsel ({beregner.done}/{beregner.total})...</div>
      )}

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
                  { lbl: 'Kørselsdage', val: dage.length, icon: '📅' },
                  { lbl: 'Km i alt', val: `${totalKm.toFixed(1)} km`, icon: '🗺' },
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

              {manglerKm.length > 0 && !beregner && (
                <div className="info-box" style={{ marginBottom: 16 }}>⚠ {manglerKm.length} {manglerKm.length === 1 ? 'sag mangler' : 'sager mangler'} km og tælles ikke med i fradraget. Tjek at din startadresse er sat under Indstillinger, og at sagens adresse er korrekt.</div>
              )}

              {beregnerRuter && (
                <div className="info-box" style={{ marginBottom: 16 }}>⏳ Beregner ruter for dage med flere sager...</div>
              )}
              {separateSager > 0 && !beregnerRuter && (
                <div className="info-box" style={{ marginBottom: 16 }}>* {separateSager} {separateSager === 1 ? 'sag' : 'sager'} på dage med flere opgaver kunne ikke indgå i dagens rute (typisk fordi adressen ikke blev fundet på kortet). De er regnet som en separat tur hjemmefra. Ret adressen på sagen, hvis det er en fejl.</div>
              )}

              <div className="card">
                <div className="section-hd">Kørsel pr. sag</div>
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr><th>Dato</th><th>Adresse</th><th>Kunde</th><th>Strækning</th><th>Km</th><th>Fradrag</th></tr>
                    </thead>
                    <tbody>
                      {rækker.map(s => (
                        <tr key={s.id} onClick={() => navigate(`/sager/${s.id}`)} style={{ cursor: 'pointer' }}>
                          <td>{s.dato ? new Date(s.dato + 'T12:00:00').toLocaleDateString('da-DK') : '—'}</td>
                          <td>{s.adresse}</td>
                          <td>{s.kunde?.navn || '—'}</td>
                          {s.km == null ? (
                            <td colSpan={3} style={{ color: 'var(--muted)' }}>{s.venter ? 'Beregner rute...' : beregner ? 'Beregner...' : 'Km kunne ikke beregnes – tjek adressen'}</td>
                          ) : (
                            <>
                              <td style={{ color: 'var(--muted)', fontSize: 12 }}>{s.strækning}{s.separat ? ' *' : ''}</td>
                              <td>{s.km.toFixed(1)} km</td>
                              <td style={{ color: 'var(--grn)', fontWeight: 600 }}>{Math.round(s.km * KM_TAKST).toLocaleString('da-DK')} kr</td>
                            </>
                          )}
                        </tr>
                      ))}
                      <tr style={{ fontWeight: 700, background: '#f5f7f9', borderTop: '1.5px solid var(--brd)' }}>
                        <td colSpan={4}><b>Total</b></td>
                        <td><b>{totalKm.toFixed(1)} km</b></td>
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
