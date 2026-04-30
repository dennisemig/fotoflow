import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Booking() {
  const { slug } = useParams()
  const [pakker, setPakker] = useState([])
  const [tillaeg, setTillaeg] = useState([])
  const [optagedeDatoer, setOptagedeDatoer] = useState([])
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    adresse: '', dato: '', tidspunkt: '', maegler_navn: '',
    maegler_email: '', maegler_firma: '', sagsnummer: '', pakke_id: '', tillaeg: [], noter: ''
  })
  const [valgtPakke, setValgtPakke] = useState(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    supabase.from('pakker').select('*').eq('aktiv', true).order('pris')
      .then(({ data }) => setPakker(data || []))
    supabase.from('tillaeg').select('*').eq('aktiv', true).order('pris')
      .then(({ data }) => setTillaeg(data || []))
    fetchOptagedeDatoer()
  }, [])

  async function fetchOptagedeDatoer() {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('sager')
      .select('dato, tidspunkt, tidspunkt_slut')
      .gte('dato', today)
      .not('status', 'eq', 'afsluttet')
    setOptagedeDatoer(data || [])
  }

  const [arbejdstider, setArbejdstider] = useState(null)

  useEffect(() => {
    supabase.from('indstillinger').select('vaerdi').eq('noegle', 'arbejdstider').single()
      .then(({ data }) => {
        if (data?.vaerdi) setArbejdstider(data.vaerdi)
        else setArbejdstider({
          1: { aktiv: true, fra: '08:00', til: '16:00' },
          2: { aktiv: true, fra: '08:00', til: '16:00' },
          3: { aktiv: true, fra: '08:00', til: '16:00' },
          4: { aktiv: true, fra: '08:00', til: '16:00' },
          5: { aktiv: true, fra: '08:00', til: '14:00' },
          6: { aktiv: false, fra: '09:00', til: '13:00' },
          0: { aktiv: false, fra: '09:00', til: '13:00' },
        })
      })
  }, [])

  function getSlotsForDay(dagIdx) {
    if (!arbejdstider) return []
    const dag = arbejdstider[dagIdx]
    if (!dag?.aktiv) return []
    const slots = []
    let current = dag.fra
    while (current < dag.til) {
      slots.push(current)
      const [h] = current.split(':').map(Number)
      current = `${String(h + 1).padStart(2, '0')}:00`
    }
    return slots
  }

  function getDatoStatus(dayStr) {
    const sagsForDay = optagedeDatoer.filter(s => s.dato === dayStr)
    const ugedag = new Date(dayStr + 'T12:00:00').getDay()
    const slots = getSlotsForDay(ugedag)
    if (slots.length === 0) return 'lukket'
    const optagetSlots = sagsForDay.map(s => s.tidspunkt ? String(s.tidspunkt).slice(0, 5) : null).filter(Boolean)
    const ledigeSlots = slots.filter(s => !optagetSlots.includes(s))
    if (ledigeSlots.length === 0) return 'optaget'
    if (sagsForDay.length > 0) return 'delvis'
    return 'ledig'
  }

  function getLedigeTider(dato) {
    if (!dato) return []
    const ugedag = new Date(dato + 'T12:00:00').getDay()
    const slots = getSlotsForDay(ugedag)
    const optagetSlots = optagedeDatoer
      .filter(s => s.dato === dato)
      .map(s => s.tidspunkt ? String(s.tidspunkt).slice(0, 5) : null)
      .filter(Boolean)
    return slots.filter(s => !optagetSlots.includes(s))
  }

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const firstDay = (new Date(calYear, calMonth, 1).getDay() || 7) - 1
  const monthName = new Date(calYear, calMonth, 1).toLocaleString('da-DK', { month: 'long', year: 'numeric' })
  const todayStr = new Date().toISOString().split('T')[0]

  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }

  function vælgDag(dayStr) {
    const status = getDatoStatus(dayStr)
    if (status === 'lukket' || status === 'optaget') return
    if (dayStr < todayStr) return
    set('dato', dayStr)
    set('tidspunkt', '') // Reset tidspunkt når dato skifter
  }

  function toggleTillaeg(id) {
    setForm(f => ({ ...f, tillaeg: f.tillaeg.includes(id) ? f.tillaeg.filter(t => t !== id) : [...f.tillaeg, id] }))
  }

  const total = (valgtPakke?.pris || 0) + form.tillaeg.reduce((a, id) => {
    const t = tillaeg.find(t => t.id === id)
    return a + (t?.pris || 0)
  }, 0)

  async function handleSend() {
    if (!form.adresse || !form.dato || !form.tidspunkt || !form.maegler_email || !form.pakke_id) return
    setSending(true)
    const { error } = await supabase.from('bookings').insert([{
      adresse: form.adresse, dato: form.dato, tidspunkt: form.tidspunkt,
      maegler_navn: form.maegler_navn, maegler_email: form.maegler_email,
      maegler_firma: form.maegler_firma, sagsnummer: form.sagsnummer, pakke: valgtPakke?.navn,
      tillaeg: form.tillaeg.map(id => tillaeg.find(t => t.id === id)?.navn).filter(Boolean),
      noter: form.noter, status: 'afventer'
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
    <div style={{ minHeight: '100vh', background: '#f4f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 40, textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#2e7d4f', marginBottom: 8 }}>Booking sendt!</div>
        <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
          Tak for din booking. VaniaGraphics bekræfter inden for 2 timer, og du modtager en bekræftelsesmail på {form.maegler_email}.
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f4f5f7', padding: '20px 16px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ background: '#3A4A5A', borderRadius: '14px 14px 0 0', padding: '20px 24px', color: '#fff' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>📷 VaniaGraphics</div>
          <div style={{ fontSize: 13, opacity: .75, marginTop: 2 }}>Book en fotografering</div>
        </div>

        {/* STEP INDICATOR */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', background: '#e8edf1' }}>
          {['Adresse', 'Dato & tid', 'Pakke', 'Kontakt'].map((s, i) => (
            <div key={s} style={{ padding: '8px 4px', textAlign: 'center', fontSize: 11, fontWeight: 600, background: i + 1 === step ? '#3A4A5A' : i + 1 < step ? '#2e7d4f' : '#e8edf1', color: i + 1 <= step ? '#fff' : '#6b7280' }}>
              {i + 1 < step ? '✓ ' : ''}{s}
            </div>
          ))}
        </div>

        <div style={{ background: '#fff', borderRadius: '0 0 14px 14px', padding: 24, border: '.5px solid #e5e7eb', borderTop: 'none' }}>

          {/* STEP 1 – ADRESSE */}
          {step === 1 && (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>Ejendomsadresse *</label>
                <input value={form.adresse} onChange={e => set('adresse', e.target.value)}
                  placeholder="f.eks. Lyngvigvej 12, 2720 Vanløse"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} autoFocus />
              </div>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={!form.adresse} onClick={() => setStep(2)}>
                Vælg dato og tid →
              </button>
            </>
          )}

          {/* STEP 2 – DATO OG TIDSPUNKT */}
          {step === 2 && (
            <>
              {/* KALENDER */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#3A4A5A', padding: '2px 8px' }}>‹</button>
                  <div style={{ fontWeight: 700, fontSize: 14, textTransform: 'capitalize', color: '#3A4A5A' }}>{monthName}</div>
                  <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#3A4A5A', padding: '2px 8px' }}>›</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
                  {['Ma','Ti','On','To','Fr','Lø','Sø'].map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: 10, color: '#6b7280', fontWeight: 600, padding: '3px 0' }}>{d}</div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
                  {[...Array(firstDay)].map((_, i) => <div key={'e'+i} />)}
                  {[...Array(daysInMonth)].map((_, i) => {
                    const day = i + 1
                    const dayStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                    const isPast = dayStr < todayStr
                    const isToday = dayStr === todayStr
                    const isValgt = dayStr === form.dato
                    const status = isPast ? 'fortid' : getDatoStatus(dayStr)

                    const bgColor = isValgt ? '#3A4A5A'
                      : status === 'optaget' ? '#fee2e2'
                      : status === 'lukket' || status === 'fortid' ? '#f3f4f6'
                      : status === 'delvis' ? '#fef3c7'
                      : isToday ? '#eef4f8'
                      : '#fff'

                    const textColor = isValgt ? '#fff'
                      : status === 'optaget' ? '#ef4444'
                      : status === 'lukket' || status === 'fortid' ? '#d1d5db'
                      : status === 'delvis' ? '#d97706'
                      : isToday ? '#3A4A5A'
                      : '#1a1a1a'

                    const canClick = !isPast && status !== 'lukket' && status !== 'optaget'

                    return (
                      <div key={day}
                        onClick={() => canClick && vælgDag(dayStr)}
                        style={{
                          textAlign: 'center', padding: '7px 2px', borderRadius: 6, fontSize: 12,
                          fontWeight: isValgt || isToday ? 700 : 400,
                          background: bgColor, color: textColor,
                          cursor: canClick ? 'pointer' : 'default',
                          border: isValgt ? '2px solid #3A4A5A' : isToday ? '1.5px solid #8fa8bc' : '1px solid #f0f0f0',
                          transition: 'all .1s'
                        }}>
                        {day}
                      </div>
                    )
                  })}
                </div>

                {/* FARVE FORKLARING */}
                <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                  {[
                    { color: '#fff', border: '#d1d5db', label: 'Ledig' },
                    { color: '#fef3c7', border: '#fbbf24', label: 'Delvis optaget' },
                    { color: '#fee2e2', border: '#fca5a5', label: 'Fuldt optaget' },
                    { color: '#f3f4f6', border: '#e5e7eb', label: 'Lukket' },
                  ].map(l => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                      <div style={{ width: 14, height: 14, borderRadius: 3, background: l.color, border: `1px solid ${l.border}` }}></div>
                      <span style={{ color: '#6b7280' }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* TIDSSLOTS */}
              {form.dato && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#3A4A5A', marginBottom: 8 }}>
                    Vælg tidspunkt – {new Date(form.dato + 'T12:00:00').toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                  {getLedigeTider(form.dato).length === 0 ? (
                    <div style={{ color: '#ef4444', fontSize: 13 }}>Ingen ledige tider denne dag</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                      {getLedigeTider(form.dato).map(tid => (
                        <div key={tid} onClick={() => set('tidspunkt', tid)}
                          style={{
                            textAlign: 'center', padding: '8px 4px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                            cursor: 'pointer', border: '1.5px solid',
                            borderColor: form.tidspunkt === tid ? '#3A4A5A' : '#e5e7eb',
                            background: form.tidspunkt === tid ? '#3A4A5A' : '#fff',
                            color: form.tidspunkt === tid ? '#fff' : '#1a1a1a',
                            transition: 'all .15s'
                          }}>
                          {tid}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!form.dato && (
                <div style={{ color: '#6b7280', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
                  Vælg en dato i kalenderen ovenfor
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(1)}>← Tilbage</button>
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={!form.dato || !form.tidspunkt} onClick={() => setStep(3)}>Vælg pakke →</button>
              </div>
            </>
          )}

          {/* STEP 3 – PAKKE */}
          {step === 3 && (
            <>
              <div style={{ marginBottom: 14 }}>
                {pakker.map(p => (
                  <div key={p.id} onClick={() => { setValgtPakke(p); set('pakke_id', p.id) }}
                    style={{ border: form.pakke_id === p.id ? '2px solid #3A4A5A' : '1px solid #e5e7eb', borderRadius: 10, padding: 14, marginBottom: 8, cursor: 'pointer', background: form.pakke_id === p.id ? '#f5f8fa' : '#fff' }}>
                    {p.popular && <div style={{ fontSize: 10, fontWeight: 700, color: '#b45309', marginBottom: 4 }}>⭐ Mest populær</div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: '#3A4A5A', fontSize: 14 }}>{p.navn}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{p.max_billeder} billeder · {p.leveringstid}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: 16, color: '#3A4A5A' }}>{p.pris?.toLocaleString('da-DK')} kr</div>
                        {form.pakke_id === p.id && <div style={{ fontSize: 11, color: '#2e7d4f', fontWeight: 600 }}>✓ Valgt</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {tillaeg.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Tillæg</div>
                  {tillaeg.map(t => (
                    <div key={t.id} onClick={() => toggleTillaeg(t.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '.5px solid #e5e7eb', cursor: 'pointer' }}>
                      <div style={{ width: 20, height: 20, borderRadius: 5, border: form.tillaeg.includes(t.id) ? '2px solid #3A4A5A' : '2px solid #e5e7eb', background: form.tillaeg.includes(t.id) ? '#3A4A5A' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, flexShrink: 0 }}>
                        {form.tillaeg.includes(t.id) ? '✓' : ''}
                      </div>
                      <span style={{ fontSize: 16 }}>{t.ikon}</span>
                      <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{t.navn}</div><div style={{ fontSize: 11, color: '#6b7280' }}>{t.beskrivelse}</div></div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#3A4A5A' }}>+ {t.pris?.toLocaleString('da-DK')} kr</div>
                    </div>
                  ))}
                </div>
              )}

              {form.pakke_id && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, color: '#3A4A5A', padding: '12px 0', borderTop: '1.5px solid #e5e7eb', marginBottom: 16 }}>
                  <span>Total</span><span>{total.toLocaleString('da-DK')} kr</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(2)}>← Tilbage</button>
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={!form.pakke_id} onClick={() => setStep(4)}>Udfyld kontakt →</button>
              </div>
            </>
          )}

          {/* STEP 4 – KONTAKT */}
          {step === 4 && (
            <>
              {/* OPSUMMERING */}
              <div style={{ background: '#f4f5f7', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 13 }}>
                <div style={{ fontWeight: 600, color: '#3A4A5A', marginBottom: 6 }}>Din booking:</div>
                <div>📍 {form.adresse}</div>
                <div>📅 {form.dato ? new Date(form.dato + 'T12:00:00').toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''} · kl. {form.tidspunkt}</div>
                <div>📦 {valgtPakke?.navn} – {total.toLocaleString('da-DK')} kr</div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>Dit navn *</label>
                <input value={form.maegler_navn} onChange={e => set('maegler_navn', e.target.value)} placeholder="Lars Bo Hansen" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} autoFocus />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>Din email *</label>
                <input type="email" value={form.maegler_email} onChange={e => set('maegler_email', e.target.value)} placeholder="lars@maegler.dk" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>Mæglerfirma</label>
                <input value={form.maegler_firma} onChange={e => set('maegler_firma', e.target.value)} placeholder="EDC, Danbolig, Nybolig..." style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>Sagsnummer</label>
                <input value={form.sagsnummer} onChange={e => set('sagsnummer', e.target.value)} placeholder="f.eks. 12345 eller MW-2024-1234" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 }}>Noter til fotografen</label>
                <textarea value={form.noter} onChange={e => set('noter', e.target.value)} placeholder="Adgangskode til ejendommen, særlige ønsker..." rows={3} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>

              <div style={{ background: '#e6f0ea', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#2e7d4f', marginBottom: 14 }}>
                Booking bekræftes af VaniaGraphics inden for 2 timer. Du modtager en bekræftelsesmail.
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(3)}>← Tilbage</button>
                <button className="btn btn-green" style={{ flex: 1, justifyContent: 'center' }} disabled={sending || !form.maegler_email || !form.maegler_navn} onClick={handleSend}>
                  {sending ? 'Sender...' : 'Send booking →'}
                </button>
              </div>
              <div style={{ textAlign: 'center', fontSize: 11, color: '#6b7280', marginTop: 8 }}>Ingen betaling kræves nu</div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
