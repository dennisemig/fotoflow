import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function NySag() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ adresse: '', dato: '', tidspunkt: '10:00', type: 'Ejendom', beskrivelse: '', noter: '', kunde_id: '', freelancer_id: '', pakke_id: '' })
  const [bbr, setBbr] = useState(null)
  const [bbrLoading, setBbrLoading] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [kunder, setKunder] = useState([])
  const [freelancere, setFreelancere] = useState([])
  const [pakker, setPakker] = useState([])
  const [saving, setSaving] = useState(false)
  const addrTimer = useRef(null)

  useEffect(() => {
    Promise.all([
      supabase.from('kunder').select('id, navn').order('navn'),
      supabase.from('profiles').select('id, navn').eq('rolle', 'freelancer').order('navn'),
      supabase.from('pakker').select('id, navn, pris').eq('aktiv', true)
    ]).then(([{ data: k }, { data: f }, { data: p }]) => {
      setKunder(k || [])
      setFreelancere(f || [])
      setPakker(p || [])
    })
  }, [])

  function handleAddrChange(val) {
    setForm(f => ({ ...f, adresse: val }))
    setBbr(null)
    clearTimeout(addrTimer.current)
    if (val.length < 4) { setSuggestions([]); return }
    addrTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.dataforsyningen.dk/autocomplete?q=${encodeURIComponent(val)}&type=adresse&per_side=5`)
        const data = await res.json()
        setSuggestions(data.map(d => ({ tekst: d.tekst, id: d.data?.id })))
      } catch { setSuggestions([]) }
    }, 300)
  }

  async function pickAddress(tekst, adresseId) {
    setForm(f => ({ ...f, adresse: tekst }))
    setSuggestions([])
    if (!adresseId) return
    setBbrLoading(true)
    try {
      // Hent BBR data via DAWA
      const res = await fetch(`https://api.dataforsyningen.dk/adresser/${adresseId}?format=json`)
      const addr = await res.json()
      // Hent bygningsdata
      const bbrRes = await fetch(`https://api.dataforsyningen.dk/bbrlight/enheder?adresseid=${adresseId}`)
      const bbrData = await bbrRes.json()
      if (bbrData?.length > 0) {
        const b = bbrData[0]
        setBbr({
          boligareal: b.ENH_BOLIGAREAL_AREAL || b.ENH_BOLIGAREAL || null,
          grundareal: addr?.adgangsadresse?.jordstykke?.registreretAreal || null,
          etager: b.BYG_ANTAL_ETAGER || null,
          byggeaar: b.BYG_OPFORELSESAAR || null,
          boligtype: b.ENH_ANVEND_KODE_TEKST || null
        })
      }
    } catch { /* BBR lookup fejlede – fortsæt uden */ }
    setBbrLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      ...form,
      ...(bbr || {}),
      kunde_id: form.kunde_id || null,
      freelancer_id: form.freelancer_id || null,
      pakke_id: form.pakke_id || null,
      status: 'ny'
    }
    const { data, error } = await supabase.from('sager').insert(payload).select().single()
    if (!error && form.freelancer_id) {
      // Send notifikation til freelancer (via Resend serverless function)
      await supabase.from('notifikationer').insert({
        bruger_id: form.freelancer_id,
        titel: 'Du er booket på en ny sag',
        besked: `Sag: ${form.adresse} · ${form.dato}`,
        type: 'booking',
        link: `/freelancer/sager/${data.id}`
      })
    }
    setSaving(false)
    if (!error) navigate(`/sager/${data.id}`)
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button className="btn btn-outline btn-sm" onClick={() => navigate('/sager')}>← Tilbage</button>
        <div className="page-title" style={{ marginBottom: 0 }}>Opret ny sag</div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* ADRESSE */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="section-hd">Adresse og ejendomsdata</div>
          <div className="form-group" style={{ position: 'relative' }}>
            <label>Ejendomsadresse *</label>
            <input type="text" value={form.adresse} onChange={e => handleAddrChange(e.target.value)} placeholder="Begynd at taste adresse..." required />
            {suggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surf)', borderRadius: 8, border: '0.5px solid var(--brd)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 10 }}>
                {suggestions.map((s, i) => (
                  <div key={i} onClick={() => pickAddress(s.tekst, s.id)}
                    style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '0.5px solid var(--brd)' }}
                    onMouseEnter={e => e.target.style.background = 'var(--bg)'}
                    onMouseLeave={e => e.target.style.background = 'transparent'}>
                    {s.tekst}
                  </div>
                ))}
              </div>
            )}
          </div>

          {bbrLoading && <div style={{ color: 'var(--muted)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>⏳ Henter BBR-data...</div>}

          {bbr && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--grn)', fontWeight: 600, marginBottom: 8 }}>✓ BBR-data hentet automatisk</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {[
                  { label: 'Boligareal', value: bbr.boligareal ? `${bbr.boligareal} m²` : '—', icon: '📐' },
                  { label: 'Grundstørrelse', value: bbr.grundareal ? `${bbr.grundareal} m²` : '—', icon: '🌿' },
                  { label: 'Antal etager', value: bbr.etager ? `${bbr.etager} plan` : '—', icon: '🏠' },
                ].map((b, i) => (
                  <div key={i} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{b.icon}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--pr)' }}>{b.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{b.label}</div>
                  </div>
                ))}
              </div>
              {bbr.byggeaar && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Byggeår: {bbr.byggeaar} · {bbr.boligtype || ''}</div>}
            </div>
          )}
        </div>

        {/* SAGDETALJER */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="section-hd">Sagsdetaljer</div>
          <div className="grid-2">
            <div className="form-group">
              <label>Dato</label>
              <input type="date" value={form.dato} onChange={e => setForm(f => ({ ...f, dato: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Tidspunkt</label>
              <input type="time" value={form.tidspunkt} onChange={e => setForm(f => ({ ...f, tidspunkt: e.target.value }))} />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label>Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {['Ejendom','Portræt','Bryllup','Event','Mode','Produkt','Andet'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Pakke</label>
              <select value={form.pakke_id} onChange={e => setForm(f => ({ ...f, pakke_id: e.target.value }))}>
                <option value="">— Vælg pakke —</option>
                {pakker.map(p => <option key={p.id} value={p.id}>{p.navn} – {p.pris.toLocaleString('da-DK')} kr</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Beskrivelse</label>
            <textarea value={form.beskrivelse} onChange={e => setForm(f => ({ ...f, beskrivelse: e.target.value }))} rows={3} placeholder="Sagsbeskrivelse..." />
          </div>
        </div>

        {/* KUNDE & FREELANCER */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="section-hd">Kunde og freelancer</div>
          <div className="grid-2">
            <div className="form-group">
              <label>Kunde</label>
              <select value={form.kunde_id} onChange={e => setForm(f => ({ ...f, kunde_id: e.target.value }))}>
                <option value="">— Vælg kunde —</option>
                {kunder.map(k => <option key={k.id} value={k.id}>{k.navn}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Freelancer (valgfrit)</label>
              <select value={form.freelancer_id} onChange={e => setForm(f => ({ ...f, freelancer_id: e.target.value }))}>
                <option value="">— Ingen (jeg tager selv) —</option>
                {freelancere.map(f => <option key={f.id} value={f.id}>{f.navn}</option>)}
              </select>
            </div>
          </div>
          {form.freelancer_id && (
            <div className="info-box" style={{ marginTop: 4 }}>📧 Freelanceren modtager automatisk en notifikation på mail ved oprettelse.</div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-outline" onClick={() => navigate('/sager')}>Annuller</button>
          <button type="submit" className="btn btn-green" disabled={saving}>{saving ? 'Opretter...' : 'Opret sag'}</button>
        </div>
      </form>
    </div>
  )
}
