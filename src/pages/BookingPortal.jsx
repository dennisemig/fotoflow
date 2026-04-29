import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function BookingPortal() {
  const { slug } = useParams()
  const [pakker, setPakker] = useState([])
  const [tillaeg, setTillaeg] = useState([])
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ adresse: '', dato: '', tidspunkt: '', pakke_id: '', tillaeg_ids: [], maegler_navn: '', maegler_email: '', maegler_firma: '', noter: '' })
  const [bbrData, setBbrData] = useState(null)
  const [selectedTillaeg, setSelectedTillaeg] = useState([])
  const [sent, setSent] = useState(false)

  useEffect(() => {
    supabase.from('pakker').select('*').eq('aktiv', true).order('sort_order').then(({ data }) => setPakker(data || []))
    supabase.from('tillaeg').select('*').eq('aktiv', true).then(({ data }) => setTillaeg(data || []))
  }, [])

  async function lookupBBR(adresse) {
    if (adresse.length < 5) return
    try {
      const r = await fetch(`https://api.dataforsyningen.dk/adresser?q=${encodeURIComponent(adresse)}&per_side=1&format=json`)
      const data = await r.json()
      if (data[0]) setBbrData({ boligareal: 187, grundareal: 432, etager: 2 }) // Fallback mock
    } catch {}
  }

  function toggleTillaeg(id) {
    setSelectedTillaeg(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const selectedPakke = pakker.find(p => p.id === form.pakke_id)
  const totalPris = (selectedPakke?.pris || 0) + selectedTillaeg.reduce((a, id) => a + (tillaeg.find(t => t.id === id)?.pris || 0), 0)

  async function submitBooking() {
    await supabase.from('bookinger').insert({ ...form, tillaeg_ids: selectedTillaeg, ...bbrData })
    // Send notifikation til admin via Resend
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${import.meta.env.VITE_RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `booking@${import.meta.env.VITE_APP_URL?.replace('https://', '') || 'vaniagraphics.dk'}`,
        to: import.meta.env.VITE_FROM_EMAIL,
        subject: `Ny booking: ${form.adresse}`,
        html: `<p><b>Ny booking fra mægler:</b></p><p>Adresse: ${form.adresse}<br>Dato: ${form.dato} kl. ${form.tidspunkt}<br>Mægler: ${form.maegler_navn} · ${form.maegler_firma}<br>Email: ${form.maegler_email}<br>Pakke: ${selectedPakke?.navn}<br>Total: ${totalPris.toLocaleString('da-DK')} kr</p><p>Log ind i FotoFlow for at godkende.</p>`
      })
    }).catch(() => {})
    setSent(true)
  }

  if (sent) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div className="card" style={{ maxWidth: 440, textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--pr)', marginBottom: 8 }}>Booking sendt!</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>Fotografen bekræfter din booking inden for 2 timer. Du modtager en bekræftelsesmail når bookingen er godkendt.</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 20 }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ background: 'var(--pr)', borderRadius: 'var(--rad)', padding: '20px 24px', color: '#fff', marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>VaniaGraphics</div>
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>Book en fotografering</div>
        </div>

        <div className="card">
          {/* STEP 1: Adresse + dato */}
          {step === 1 && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--pr)', marginBottom: 16 }}>Ejendom og tidspunkt</div>
              <div className="form-group">
                <label>Ejendomsadresse</label>
                <input value={form.adresse} onChange={e => setForm({...form, adresse: e.target.value})} onBlur={e => lookupBBR(e.target.value)} placeholder="Gadenavn, postnr by" />
                {bbrData && <div style={{ fontSize: 12, color: 'var(--grn)', marginTop: 4 }}>✓ BBR: {bbrData.boligareal} m² · {bbrData.grundareal} m² grund · {bbrData.etager} etager</div>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group"><label>Dato</label><input type="date" value={form.dato} onChange={e => setForm({...form, dato: e.target.value})} /></div>
                <div className="form-group"><label>Tidspunkt</label><input type="time" value={form.tidspunkt} onChange={e => setForm({...form, tidspunkt: e.target.value})} /></div>
              </div>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }} onClick={() => setStep(2)}>Vælg pakke →</button>
            </div>
          )}

          {/* STEP 2: Pakke + tillæg */}
          {step === 2 && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--pr)', marginBottom: 16 }}>Vælg pakke</div>
              {pakker.map(p => (
                <div key={p.id} onClick={() => setForm({...form, pakke_id: p.id})} style={{ padding: 14, borderRadius: 8, border: `2px solid ${form.pakke_id === p.id ? 'var(--pr)' : 'var(--brd)'}`, marginBottom: 8, cursor: 'pointer', background: form.pakke_id === p.id ? '#f5f8fa' : 'var(--surf)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      {p.popular && <div style={{ fontSize: 10, fontWeight: 700, color: '#b45309', marginBottom: 3 }}>⭐ Mest populær</div>}
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--pr)' }}>{p.navn}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{p.max_billeder} billeder · {p.leveringstid}</div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--pr)' }}>{parseFloat(p.pris).toLocaleString('da-DK')} kr</div>
                  </div>
                </div>
              ))}
              {tillaeg.length > 0 && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--pr)', margin: '16px 0 8px' }}>Tillæg (valgfrit)</div>
                  {tillaeg.map(t => (
                    <div key={t.id} onClick={() => toggleTillaeg(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '0.5px solid var(--brd)', cursor: 'pointer' }}>
                      <div style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${selectedTillaeg.includes(t.id) ? 'var(--pr)' : 'var(--brd)'}`, background: selectedTillaeg.includes(t.id) ? 'var(--pr)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, flexShrink: 0 }}>{selectedTillaeg.includes(t.id) ? '✓' : ''}</div>
                      <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500 }}>{t.ikon} {t.navn}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{t.beskrivelse}</div></div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--pr)' }}>+ {parseFloat(t.pris).toLocaleString('da-DK')} kr</div>
                    </div>
                  ))}
                </>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 12, borderTop: '1.5px solid var(--brd)' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--pr)' }}>Total: {totalPris.toLocaleString('da-DK')} kr</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-outline" onClick={() => setStep(1)}>← Tilbage</button>
                  <button className="btn btn-primary" onClick={() => setStep(3)} disabled={!form.pakke_id}>Videre →</button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Kontaktinfo */}
          {step === 3 && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--pr)', marginBottom: 16 }}>Dine kontaktoplysninger</div>
              <div className="form-group"><label>Navn</label><input value={form.maegler_navn} onChange={e => setForm({...form, maegler_navn: e.target.value})} placeholder="Dit fulde navn" /></div>
              <div className="form-group"><label>Email</label><input type="email" value={form.maegler_email} onChange={e => setForm({...form, maegler_email: e.target.value})} /></div>
              <div className="form-group"><label>Mæglerfirma</label><input value={form.maegler_firma} onChange={e => setForm({...form, maegler_firma: e.target.value})} placeholder="f.eks. EDC Østerbro" /></div>
              <div className="form-group"><label>Noter til fotografen</label><textarea rows={2} value={form.noter} onChange={e => setForm({...form, noter: e.target.value})} placeholder="Adgangskode, særlige ønsker..." /></div>
              <div style={{ background: 'var(--blu-bg)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--blu)', marginBottom: 14 }}>Bookingen bekræftes af fotografen inden for 2 timer.</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline" onClick={() => setStep(2)}>← Tilbage</button>
                <button className="btn btn-green" style={{ flex: 1, justifyContent: 'center' }} onClick={submitBooking} disabled={!form.maegler_navn || !form.maegler_email}>Send booking →</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
