import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Booking() {
  const { slug } = useParams()
  const [pakker, setPakker] = useState([])
  const [tillaeg, setTillaeg] = useState([])
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ adresse: '', dato: '', tidspunkt: '', maegler_navn: '', maegler_email: '', maegler_firma: '', pakke_id: '', tillaeg: [], noter: '' })
  const [bbr, setBbr] = useState(null)
  const [bbrLoading, setBbrLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [valgtPakke, setValgtPakke] = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    supabase.from('pakker').select('*').eq('aktiv', true).order('pris').then(({ data }) => setPakker(data || []))
    supabase.from('tillaeg').select('*').eq('aktiv', true).order('pris').then(({ data }) => setTillaeg(data || []))
  }, [])

  async function lookupBBR(adresse) {
    if (adresse.length < 8) return
    setBbrLoading(true)
    try {
      const r = await fetch(`https://api.dataforsyningen.dk/adresser?q=${encodeURIComponent(adresse)}&per_side=1`)
      const d = await r.json()
      if (d.length > 0) setBbr({ adresseId: d[0].id, vejnavn: d[0].vejnavn, postnr: d[0].postnr })
    } catch (e) {}
    setBbrLoading(false)
  }

  function toggleTillaeg(id) {
    setForm(f => ({ ...f, tillaeg: f.tillaeg.includes(id) ? f.tillaeg.filter(t => t !== id) : [...f.tillaeg, id] }))
  }

  const total = (valgtPakke?.pris || 0) + form.tillaeg.reduce((a, id) => { const t = tillaeg.find(t => t.id === id); return a + (t?.pris || 0) }, 0)

  async function handleSend() {
    if (!form.adresse || !form.dato || !form.maegler_email || !form.pakke_id) return
    setSending(true)
    const { error } = await supabase.from('bookings').insert([{
      adresse: form.adresse, dato: form.dato, tidspunkt: form.tidspunkt,
      maegler_navn: form.maegler_navn, maegler_email: form.maegler_email,
      maegler_firma: form.maegler_firma, pakke: valgtPakke?.navn,
      tillaeg: form.tillaeg.map(id => tillaeg.find(t => t.id === id)?.navn).filter(Boolean),
      noter: form.noter, status: 'afventer', bbr_data: bbr
    }])
    if (!error) {
      await fetch('/api/send-notification', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'ny_booking', mægler: { ...form, pakke: valgtPakke?.navn, total } })
      }).catch(() => {})
      setSent(true)
    }
    setSending(false)
  }

  if (sent) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surf)', borderRadius: 14, padding: 40, textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--grn)', marginBottom: 8 }}>Booking sendt!</div>
        <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>Tak for din booking. VaniaGraphics bekræfter inden for 2 timer, og du modtager en bekræftelsesmail på {form.maegler_email}.</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 20 }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ background: 'var(--pr)', borderRadius: '14px 14px 0 0', padding: '20px 24px', color: '#fff' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>📷 VaniaGraphics</div>
          <div style={{ fontSize: 13, opacity: .75, marginTop: 2 }}>Book en fotografering</div>
        </div>

        {/* STEP INDICATOR */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', background: '#e8edf1' }}>
          {['Ejendom', 'Pakke', 'Kontakt'].map((s, i) => (
            <div key={s} style={{ padding: '8px 4px', textAlign: 'center', fontSize: 11, fontWeight: 600, background: i + 1 === step ? 'var(--pr)' : i + 1 < step ? 'var(--grn)' : '#e8edf1', color: i + 1 <= step ? '#fff' : 'var(--muted)' }}>
              {i + 1 < step ? '✓ ' : ''}{s}
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--surf)', borderRadius: '0 0 14px 14px', padding: 24, border: '.5px solid var(--brd)', borderTop: 'none' }}>

          {step === 1 && (
            <>
              <div className="form-group">
                <label>Ejendomsadresse *</label>
                <input value={form.adresse} onChange={e => set('adresse', e.target.value)} onBlur={e => lookupBBR(e.target.value)} placeholder="Gadenavn, postnummer by..." autoFocus />
                {bbrLoading && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>⏳ Verificerer adresse...</div>}
                {bbr && <div style={{ fontSize: 12, color: 'var(--grn)', marginTop: 4 }}>✓ Adresse fundet og verificeret</div>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group"><label>Ønsket dato *</label><input type="date" value={form.dato} onChange={e => set('dato', e.target.value)} min={new Date().toISOString().split('T')[0]} /></div>
                <div className="form-group"><label>Tidspunkt (ca.)</label><input type="time" value={form.tidspunkt} onChange={e => set('tidspunkt', e.target.value)} /></div>
              </div>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={!form.adresse || !form.dato} onClick={() => setStep(2)}>Vælg pakke →</button>
            </>
          )}

          {step === 2 && (
            <>
              <div style={{ marginBottom: 14 }}>
                {pakker.map(p => (
                  <div key={p.id} onClick={() => { setValgtPakke(p); set('pakke_id', p.id) }}
                    style={{ border: form.pakke_id === p.id ? '2px solid var(--pr)' : '1px solid var(--brd)', borderRadius: 10, padding: 14, marginBottom: 8, cursor: 'pointer', background: form.pakke_id === p.id ? '#f5f8fa' : 'var(--surf)' }}>
                    {p.popular && <div style={{ fontSize: 10, fontWeight: 700, color: '#b45309', marginBottom: 4 }}>⭐ Mest populær</div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div><div style={{ fontWeight: 700, color: 'var(--pr)', fontSize: 14 }}>{p.navn}</div><div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{p.maks_billeder} billeder · {p.leveringstid}</div></div>
                      <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 700, fontSize: 16, color: 'var(--pr)' }}>{p.pris?.toLocaleString('da-DK')} kr</div>{form.pakke_id === p.id && <div style={{ fontSize: 11, color: 'var(--grn)', fontWeight: 600 }}>✓ Valgt</div>}</div>
                    </div>
                  </div>
                ))}
              </div>
              {tillaeg.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Tilføj tillæg</div>
                  {tillaeg.map(t => (
                    <div key={t.id} onClick={() => toggleTillaeg(t.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '.5px solid var(--brd)', cursor: 'pointer' }}>
                      <div style={{ width: 20, height: 20, borderRadius: 5, border: form.tillaeg.includes(t.id) ? '2px solid var(--pr)' : '2px solid var(--brd)', background: form.tillaeg.includes(t.id) ? 'var(--pr)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, flexShrink: 0 }}>
                        {form.tillaeg.includes(t.id) ? '✓' : ''}
                      </div>
                      <span style={{ fontSize: 16 }}>{t.ikon}</span>
                      <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{t.navn}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{t.beskrivelse}</div></div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--pr)' }}>+ {t.pris?.toLocaleString('da-DK')} kr</div>
                    </div>
                  ))}
                </div>
              )}
              {form.pakke_id && <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, color: 'var(--pr)', padding: '12px 0', borderTop: '1.5px solid var(--brd)', marginBottom: 16 }}><span>Total</span><span>{total.toLocaleString('da-DK')} kr</span></div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(1)}>← Tilbage</button>
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={!form.pakke_id} onClick={() => setStep(3)}>Udfyld kontakt →</button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="form-group"><label>Dit navn *</label><input value={form.maegler_navn} onChange={e => set('maegler_navn', e.target.value)} placeholder="Lars Bo Hansen" autoFocus /></div>
              <div className="form-group"><label>Din email *</label><input type="email" value={form.maegler_email} onChange={e => set('maegler_email', e.target.value)} placeholder="lars@maegler.dk" /></div>
              <div className="form-group"><label>Mæglerfirma</label><input value={form.maegler_firma} onChange={e => set('maegler_firma', e.target.value)} placeholder="EDC, Danbolig, Nybolig..." /></div>
              <div className="form-group"><label>Noter til fotografen</label><textarea rows={3} value={form.noter} onChange={e => set('noter', e.target.value)} placeholder="Adgangskode til ejendommen, særlige ønsker..." /></div>
              <div className="ok-box" style={{ marginBottom: 14 }}>Booking bekræftes af VaniaGraphics inden for 2 timer. Du modtager en bekræftelsesmail.</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(2)}>← Tilbage</button>
                <button className="btn btn-green" style={{ flex: 1, justifyContent: 'center' }} disabled={sending || !form.maegler_email || !form.maegler_navn} onClick={handleSend}>{sending ? 'Sender...' : 'Send booking →'}</button>
              </div>
              <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>Ingen betaling kræves nu</div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
