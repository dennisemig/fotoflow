import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast, ToastContainer } from '../hooks/useToast'

const TYPES = ['ejendom', 'portræt', 'bryllup', 'event', 'mode', 'produkt']
const BBR_TOKEN = 'CPbVQka4R26OfpgOBMBi3sb6DnN63UVWn3kieXz844B6WJ0lxXqR8UPbOrM0eFHJ7vFmav9bw7w5pLM5Pcnk9Ws9Xyusxb7Ze'

async function getKoordinater(adresse) {
  try {
    const r = await fetch(`https://api.dataforsyningen.dk/adresser?q=${encodeURIComponent(adresse)}&per_side=1&struktur=mini`)
    const d = await r.json()
    if (d.length > 0) return { lng: d[0].x, lat: d[0].y }
  } catch (e) {}
  return null
}

async function beregnKm(fraAdresse, tilAdresse) {
  try {
    const [fra, til] = await Promise.all([getKoordinater(fraAdresse), getKoordinater(tilAdresse)])
    if (!fra || !til) return null
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${fra.lng},${fra.lat};${til.lng},${til.lat}?overview=false`)
    const d = await r.json()
    if (d.code === 'Ok' && d.routes.length > 0) {
      return Math.round(d.routes[0].distance / 1000 * 10) / 10
    }
  } catch (e) {}
  return null
}

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
    const { data: sagerData, error } = await supabase
      .from('sager')
      .select('id, adresse, dato, status, type, kunde_id, freelancer_id, created_at, maegler_navn, maegler_email, maegler_firma, maegler_sagsnummer')
      .order('created_at', { ascending: false })

    if (error) { console.error('Sager fejl:', error); setLoading(false); return }
    if (!sagerData || sagerData.length === 0) { setSager([]); setLoading(false); return }

    const kundeIds = [...new Set(sagerData.filter(s => s.kunde_id).map(s => s.kunde_id))]
    let kundeMap = {}
    if (kundeIds.length > 0) {
      const { data: kunderData } = await supabase.from('kunder').select('id, navn').in('id', kundeIds)
      if (kunderData) kunderData.forEach(k => { kundeMap[k.id] = k })
    }

    const flIds = [...new Set(sagerData.filter(s => s.freelancer_id).map(s => s.freelancer_id))]
    let flMap = {}
    if (flIds.length > 0) {
      const { data: flData } = await supabase.from('freelancere').select('id, navn').in('id', flIds)
      if (flData) flData.forEach(f => { flMap[f.id] = f })
    }

    setSager(sagerData.map(s => ({ ...s, kunde: kundeMap[s.kunde_id] || null, freelancer: flMap[s.freelancer_id] || null })))
    setLoading(false)
  }

  const filtered = sager.filter(s =>
    (s.kunde?.navn || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.maegler_navn || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.adresse || '').toLowerCase().includes(search.toLowerCase())
  )

  const badgeClass = s => ({ aktiv: 'active', afventer: 'pending', leveret: 'leveret', ny: 'new', afsluttet: 'done' }[s] || 'new')
  const statusLabel = s => ({ ny: 'Ny', aktiv: 'Aktiv', afventer: 'Afventer', afsluttet: 'Afsluttet', leveret: 'Leveret' }[s] || 'Ny')

  return (
    <div>
      <ToastContainer toasts={toasts} />
      <div className="page-title">Sager</div>
      <div className="toolbar">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Søg på kunde, mægler eller adresse..." />
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>+ Opret sag</button>
      </div>
      <div className="card">
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Indlæser sager...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">📋</div>Ingen sager endnu – opret din første!</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr><th>Kunde / Mægler</th><th>Adresse</th><th>Sagsnr.</th><th>Dato</th><th>Type</th><th>Freelancer</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} onClick={() => navigate(`/sager/${s.id}`)}>
                    <td>
                      {s.kunde?.navn
                        ? <b>{s.kunde.navn}</b>
                        : s.maegler_navn
                          ? <span><b>{s.maegler_navn}</b><br /><span style={{ fontSize: 11, color: 'var(--muted)' }}>{s.maegler_firma || 'Mægler'}</span></span>
                          : <span style={{ color: 'var(--muted)' }}>—</span>
                      }
                    </td>
                    <td>{s.adresse || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{s.maegler_sagsnummer || '—'}</td>
                    <td>{s.dato ? new Date(s.dato + 'T12:00:00').toLocaleDateString('da-DK') : '—'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{s.type || '—'}</td>
                    <td>{s.freelancer?.navn || <span style={{ color: 'var(--muted)', fontSize: 12 }}>Ingen</span>}</td>
                    <td><span className={`badge badge-${badgeClass(s.status)}`}>{statusLabel(s.status)}</span></td>
                    <td onClick={e => e.stopPropagation()}><button className="btn btn-outline btn-sm" onClick={() => navigate(`/sager/${s.id}`)}>Se sag</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showModal && <OpretSagModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); fetchSager(); toast('✓ Sag oprettet!') }} toast={toast} />}
    </div>
  )
}

function OpretSagModal({ onClose, onSaved, toast }) {
  const [form, setForm] = useState({
    adresse: '', dato: '', tidspunkt: '09:00', tidspunkt_slut: '11:00',
    type: 'ejendom', freelancer_id: '', kunde_id: '',
    maks_billeder: 20, noter: '', maegler_sagsnummer: ''
  })
  const [kunder, setKunder] = useState([])
  const [freelancere, setFreelancere] = useState([])
  const [kundeYdelser, setKundeYdelser] = useState([])
  const [valgteYdelser, setValgteYdelser] = useState([]) // [{ydelse, antal}]
  const [bbr, setBbr] = useState(null)
  const [bbrLoading, setBbrLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [kmInfo, setKmInfo] = useState(null)
  const [startadresse, setStartadresse] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    supabase.from('kunder').select('id, navn').order('navn').then(({ data }) => setKunder(data || []))
    supabase.from('freelancere').select('id, navn').eq('aktiv', true).then(({ data }) => setFreelancere(data || []))
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const { data } = await supabase.from('profiles').select('startadresse').eq('id', user.id).single()
        if (data?.startadresse) setStartadresse(data.startadresse)
      }
    })
  }, [])

  // Hent kundespecifikke ydelser når kunde vælges
  useEffect(() => {
    if (!form.kunde_id) { setKundeYdelser([]); setValgteYdelser([]); return }
    supabase.from('kunde_ydelser')
      .select('*')
      .eq('kunde_id', form.kunde_id)
      .eq('aktiv', true)
      .order('navn')
      .then(({ data }) => {
        setKundeYdelser(data || [])
        setValgteYdelser([])
      })
  }, [form.kunde_id])

  function toggleYdelse(ydelse) {
    setValgteYdelser(prev => {
      const exists = prev.find(v => v.ydelse.id === ydelse.id)
      if (exists) return prev.filter(v => v.ydelse.id !== ydelse.id)
      return [...prev, { ydelse, antal: 1 }]
    })
  }

  const ydelsesTotal = valgteYdelser.reduce((sum, v) => sum + v.ydelse.pris * v.antal, 0)

  async function lookupBBRogKm(adresse) {
    if (adresse.length < 6) return
    setBbrLoading(true)
    try {
      const r1 = await fetch(`https://api.dataforsyningen.dk/adresser?q=${encodeURIComponent(adresse)}&per_side=1&struktur=mini`)
      const d1 = await r1.json()
      if (d1 && d1.length > 0) {
        const adresseId = d1[0].id
        const adgAdrId = d1[0].adgangsadresseid
        const r2 = await fetch(`https://services.datafordeler.dk/BBR/BBRPublic/1/rest/enhed?AdresseIdentificerer=${adresseId}&MedDybde=true&token=${BBR_TOKEN}`)
        const d2 = await r2.json()
        let boligareal = null
        if (d2 && d2.length > 0) boligareal = d2[0].enh020EnhedensAreal || d2[0].enh021ArealTilBeboelse || null
        const r3 = await fetch(`https://services.datafordeler.dk/BBR/BBRPublic/1/rest/bygning?AdresseIdentificerer=${adgAdrId}&MedDybde=true&token=${BBR_TOKEN}`)
        const d3 = await r3.json()
        let grundareal = null, etager = null
        if (d3 && d3.length > 0) { grundareal = d3[0].byg041BebyggetAreal || null; etager = d3[0].byg054AntalEtager || null }
        setBbr({ adresseId, adgAdrId, boligareal, grundareal, etager })
        if (startadresse) {
          const km = await beregnKm(startadresse, adresse)
          if (km) setKmInfo({ km, tur_retur: Math.round(km * 2 * 10) / 10 })
        }
      }
    } catch (e) { console.error('BBR/km fejl:', e) }
    setBbrLoading(false)
  }

  async function handleSave() {
    if (!form.adresse || !form.dato) { toast('Udfyld adresse og dato', 'error'); return }
    setSaving(true)

    let km = kmInfo?.km || null
    if (!km && startadresse && form.adresse) {
      km = await beregnKm(startadresse, form.adresse)
    }

    const { data: sagData, error } = await supabase.from('sager').insert([{
      adresse: form.adresse,
      dato: form.dato,
      tidspunkt: form.tidspunkt || null,
      tidspunkt_slut: form.tidspunkt_slut || null,
      type: form.type,
      freelancer_id: form.freelancer_id || null,
      kunde_id: form.kunde_id || null,
      maks_billeder: form.maks_billeder,
      noter: form.noter || null,
      maegler_sagsnummer: form.maegler_sagsnummer || null,
      status: 'ny',
      bbr_data: bbr || null,
      km_distance: km,
    }]).select('id').single()

    if (error) { toast('Fejl: ' + error.message, 'error'); setSaving(false); return }

    // Gem valgte ydelser
    if (sagData?.id && valgteYdelser.length > 0) {
      await supabase.from('sag_ydelser').insert(
        valgteYdelser.map(v => ({
          sag_id: sagData.id,
          ydelse_id: v.ydelse.id,
          navn: v.ydelse.navn,
          pris: v.ydelse.pris,
          antal: v.antal
        }))
      )
    }

    setSaving(false)
    onSaved()
  }

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">Opret ny sag<button className="modal-close" onClick={onClose}>✕</button></div>

        <div className="form-group">
          <label>Adresse *</label>
          <input value={form.adresse} onChange={e => set('adresse', e.target.value)}
            onBlur={e => lookupBBRogKm(e.target.value)}
            placeholder="f.eks. Lyngvigvej 12, 2750 Ballerup" autoFocus />
          {bbrLoading && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>⏳ Henter data...</div>}
          {bbr && !bbrLoading && (
            <div style={{ fontSize: 12, color: 'var(--grn)', marginTop: 4 }}>
              ✓ Adresse fundet{bbr.boligareal ? ` · ${bbr.boligareal} m²` : ''}
              {kmInfo && <span> · <b>{kmInfo.km} km</b> fra din adresse ({kmInfo.tur_retur} km tur/retur)</span>}
            </div>
          )}
          {!startadresse && (
            <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 4 }}>⚠ Sæt din startadresse under Indstillinger for automatisk km-beregning</div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label>Kunde (valgfrit)</label>
            <select value={form.kunde_id} onChange={e => set('kunde_id', e.target.value)}>
              <option value="">— Vælg kunde —</option>
              {kunder.map(k => <option key={k.id} value={k.id}>{k.navn}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Mindworking sagsnummer</label>
            <input
              value={form.maegler_sagsnummer}
              onChange={e => set('maegler_sagsnummer', e.target.value)}
              placeholder="f.eks. N2601420000799"
            />
          </div>
        </div>

        {/* Kundespecifikke ydelser */}
        {form.kunde_id && kundeYdelser.length > 0 && (
          <div className="form-group">
            <label>Ydelser</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {kundeYdelser.map(y => {
                const valgt = valgteYdelser.find(v => v.ydelse.id === y.id)
                return (
                  <div
                    key={y.id}
                    onClick={() => toggleYdelse(y)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                      border: `1px solid ${valgt ? 'var(--pr)' : 'var(--brd)'}`,
                      background: valgt ? 'var(--pr-light, #ebf4ff)' : '#fff',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: 4,
                        border: `2px solid ${valgt ? 'var(--pr)' : 'var(--brd)'}`,
                        background: valgt ? 'var(--pr)' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, color: '#fff', flexShrink: 0
                      }}>
                        {valgt ? '✓' : ''}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{y.ikon} {y.navn}</div>
                        {y.beskrivelse && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{y.beskrivelse}</div>}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: valgt ? 'var(--pr)' : 'var(--muted)' }}>
                      {y.pris.toLocaleString('da-DK')} kr.
                    </div>
                  </div>
                )
              })}
            </div>
            {valgteYdelser.length > 0 && (
              <div style={{ marginTop: 10, padding: '10px 14px', background: '#f7fafc', borderRadius: 8, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>{valgteYdelser.length} ydelse{valgteYdelser.length !== 1 ? 'r' : ''} valgt</span>
                <span style={{ fontWeight: 700 }}>{ydelsesTotal.toLocaleString('da-DK')} kr. ex moms</span>
              </div>
            )}
          </div>
        )}

        {form.kunde_id && kundeYdelser.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, padding: '10px 14px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a' }}>
            ⚠ Ingen ydelser oprettet for denne kunde endnu. Opret dem under Kunder.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group"><label>Dato *</label><input type="date" value={form.dato} onChange={e => set('dato', e.target.value)} /></div>
          <div></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group"><label>Fra</label><input type="time" value={form.tidspunkt} onChange={e => set('tidspunkt', e.target.value)} /></div>
          <div className="form-group"><label>Til</label><input type="time" value={form.tidspunkt_slut} onChange={e => set('tidspunkt_slut', e.target.value)} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group"><label>Type</label>
            <select value={form.type} onChange={e => set('type', e.target.value)}>
              {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Maks billeder</label><input type="number" value={form.maks_billeder} onChange={e => set('maks_billeder', parseInt(e.target.value))} /></div>
        </div>
        <div className="form-group"><label>Freelancer (valgfrit)</label>
          <select value={form.freelancer_id} onChange={e => set('freelancer_id', e.target.value)}>
            <option value="">— Ingen freelancer —</option>
            {freelancere.map(f => <option key={f.id} value={f.id}>{f.navn}</option>)}
          </select>
        </div>
        <div className="form-group"><label>Noter</label><textarea rows={3} value={form.noter} onChange={e => set('noter', e.target.value)} placeholder="Sagsbeskrivelse..." /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Annuller</button>
          <button className="btn btn-green btn-sm" onClick={handleSave} disabled={saving}>{saving ? 'Opretter...' : 'Opret sag'}</button>
        </div>
      </div>
    </div>
  )
}
