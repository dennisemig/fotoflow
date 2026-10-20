import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const LOGO = 'https://app.vaniagraphics.dk/vania-logo.png'

export default function Booking() {
  const { slug } = useParams()
  const [pakker, setPakker] = useState([])
  const [tillaeg, setTillaeg] = useState([])
  const [optagedeDatoer, setOptagedeDatoer] = useState([])
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    adresse: '', dato: '', tidspunkt: '', kontakt_selger: false, selger_telefon: '',
    maegler_email: '', maegler_firma: '', sagsnummer: '', pakke_id: '', tillaeg: [], noter: ''
  })
  const [valgtPakke, setValgtPakke] = useState(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [accepteret, setAccepteret] = useState(false)
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [maegler_navn, setMaeglerNavn] = useState('')

  useEffect(() => {
    supabase.from('pakker').select('*').eq('aktiv', true).order('pris').then(({ data }) => setPakker(data || []))
    supabase.from('tillaeg').select('*').eq('aktiv', true).order('pris').then(({ data }) => setTillaeg(data || []))
  }, [])

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    Promise.all([
      supabase.from('sager').select('dato, tidspunkt, tidspunkt_slut, freelancer_id').gte('dato', today).not('status', 'eq', 'afsluttet'),
      supabase.from('kalender_blokeringer').select('dato, tidspunkt, tidspunkt_slut').gte('dato', today)
    ]).then(([sagsRes, blokeringRes]) => {
      setOptagedeDatoer([
        ...(sagsRes.data || []).map(s => ({ dato: s.dato, tidspunkt: s.tidspunkt || '00:00', tidspunkt_slut: s.tidspunkt_slut || '23:59' })),
        ...(blokeringRes.data || []).map(b => ({ dato: b.dato, tidspunkt: b.tidspunkt || '00:00', tidspunkt_slut: b.tidspunkt_slut || '23:59' }))
      ])
    })
  }, [])

  const [arbejdstider, setArbejdstider] = useState(null)
  useEffect(() => {
    supabase.from('indstillinger').select('vaerdi').eq('noegle', 'arbejdstider').single()
      .then(({ data }) => { if (data?.vaerdi) setArbejdstider(data.vaerdi) })
  }, [])

  function getArbejdstiderForDag(dagIdx) {
    if (!arbejdstider) return []
    const dag = arbejdstider[dagIdx]
    if (!dag || !dag.aktiv) return []
    return dag.tider || []
  }

  function tidTilMin(t) {
    const [h, m] = t.split(':').map(Number); return h * 60 + m
  }

  function getLedigeTider(dato) {
    if (!dato) return []
    const ugedag = new Date(dato + 'T12:00:00').getDay()
    const alleTider = getArbejdstiderForDag(ugedag)
    const sagsForDay = optagedeDatoer.filter(s => s.dato === dato)
    const heldag = sagsForDay.some(s => s.tidspunkt === '00:00' && s.tidspunkt_slut === '23:59')
    if (heldag) return []
    return alleTider.filter(tid => {
      const tidMin = tidTilMin(tid)
      return !sagsForDay.some(s => {
        const start = tidTilMin(s.tidspunkt)
        const slut = s.tidspunkt_slut ? tidTilMin(s.tidspunkt_slut) : start + 90
        return tidMin >= start && tidMin < slut
      })
    })
  }

  function erDagOptaget(dayStr) {
    const ugedag = new Date(dayStr + 'T12:00:00').getDay()
    if (ugedag === 0) return true
    const alleTider = getArbejdstiderForDag(ugedag)
    if (alleTider.length === 0) return true
    return getLedigeTider(dayStr).length === 0
  }

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const firstDay = (new Date(calYear, calMonth, 1).getDay() || 7) - 1
  const monthName = new Date(calYear, calMonth, 1).toLocaleString('da-DK', { month: 'long', year: 'numeric' })

  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }
  function toggleTillaeg(id) {
    setForm(f => ({ ...f, tillaeg: f.tillaeg.includes(id) ? f.tillaeg.filter(t => t !== id) : [...f.tillaeg, id] }))
  }

  const total = (valgtPakke?.pris || 0) + form.tillaeg.reduce((a, id) => {
    const t = tillaeg.find(t => t.id === id); return a + (t?.pris || 0)
  }, 0)

  async function handleSend() {
    if (!form.kontakt_selger && !form.dato) { alert('Vælg en dato eller vælg "Vania kontakter sælger"'); return }
    if (!form.kontakt_selger && !form.tidspunkt) { alert('Vælg et tidspunkt'); return }
    setSending(true)
    const { error } = await supabase.from('bookings').insert([{
      adresse: form.adresse,
      dato: form.kontakt_selger ? null : form.dato,
      tidspunkt: form.kontakt_selger ? null : form.tidspunkt,
      kontakt_selger: form.kontakt_selger,
      selger_telefon: form.selger_telefon || null,
      maegler_navn: maegler_navn,
      maegler_email: form.maegler_email,
      maegler_firma: form.maegler_firma,
      sagsnummer: form.sagsnummer,
      pakke: valgtPakke?.navn,
      tillaeg: form.tillaeg.map(id => tillaeg.find(t => t.id === id)?.navn).filter(Boolean),
      noter: form.noter,
      status: 'afventer'
    }])
    if (!error) {
      await fetch('/api/send-notification', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'ny_booking', mægler: { ...form, maegler_navn, pakke: valgtPakke?.navn, total } })
      }).catch(() => {})
      setSent(true)
    }
    setSending(false)
  }

  const bg = '#e8e4de'
  const text = '#1a1a1a'
  const muted = '#6b6b6b'
  const border = '#c8c4be'
  const mono = "'Courier New', monospace"
  const serif = "Georgia, serif"

  const field = {
    label: { display: 'block', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: muted, marginBottom: 6, fontFamily: mono },
    input: { width: '100%', padding: '10px 12px', border: `1px solid ${border}`, background: 'transparent', color: text, fontSize: 14, fontFamily: mono, boxSizing: 'border-box', outline: 'none' }
  }

  function btn(onClick, label, disabled) {
    return (
      <button onClick={onClick} disabled={disabled} style={{
        border: `1px solid ${disabled ? border : text}`, color: disabled ? muted : text, background: 'transparent',
        padding: '10px 22px', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: mono,
        cursor: disabled ? 'default' : 'pointer', marginTop: 8
      }}>{label} →</button>
    )
  }

  function btnBack(onClick) {
    return (
      <button onClick={onClick} style={{
        border: 'none', background: 'none', color: muted, fontSize: 11, letterSpacing: '.1em',
        textTransform: 'uppercase', fontFamily: mono, cursor: 'pointer', padding: '10px 0', marginRight: 12
      }}>← Tilbage</button>
    )
  }

  const steps = ['Adresse', 'Dato & tid', 'Pakke', 'Kontakt']

  if (sent) return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono }}>
      <div style={{ textAlign: 'center', maxWidth: 380, padding: 40 }}>
        <img src={LOGO} alt="Vania" style={{ maxWidth: 160, width: '100%', marginBottom: 32 }} />
        <div style={{ fontFamily: serif, fontSize: 22, color: text, marginBottom: 12 }}>Booking modtaget</div>
        <div style={{ fontSize: 12, color: muted, lineHeight: 1.9 }}>
          Tak for din henvendelse.<br />
          Vi bekræfter inden for 2 timer<br />
          og sender bekræftelse til<br />
          <span style={{ color: text }}>{form.maegler_email}</span>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: mono, color: text }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <img src={LOGO} alt="Vania" style={{ maxWidth: 160, width: '100%' }} />
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 40, borderBottom: `1px solid ${border}` }}>
          {steps.map((s, i) => (
            <div key={s} style={{
              flex: 1, textAlign: 'center', paddingBottom: 10, fontSize: 10, letterSpacing: '.1em',
              textTransform: 'uppercase', color: step === i + 1 ? text : muted,
              borderBottom: step === i + 1 ? `2px solid ${text}` : '2px solid transparent',
              marginBottom: -1
            }}>{s}</div>
          ))}
        </div>

        {/* Trin 1: Adresse */}
        {step === 1 && (
          <div>
            <div style={{ fontFamily: serif, fontSize: 20, marginBottom: 24 }}>Hvilken ejendom skal fotograferes?</div>
            <div style={{ marginBottom: 20 }}>
              <label style={field.label}>Adresse</label>
              <input style={field.input} value={form.adresse} onChange={e => set('adresse', e.target.value)} placeholder="Eksempelvej 12, 2100 København Ø" autoFocus />
            </div>
            {btn(() => setStep(2), 'Vælg dato og tid', !form.adresse)}
          </div>
        )}

        {/* Trin 2: Dato & tid */}
        {step === 2 && (
          <div>
            <div style={{ fontFamily: serif, fontSize: 20, marginBottom: 8 }}>Hvornår skal vi komme?</div>
            <div style={{ fontSize: 12, color: muted, marginBottom: 24 }}>{form.adresse}</div>

            {/* Valg: Book selv eller Vania kontakter sælger */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
              <button
                onClick={() => { set('kontakt_selger', false) }}
                style={{
                  flex: 1, padding: '14px 12px', border: `1px solid ${!form.kontakt_selger ? text : border}`,
                  background: !form.kontakt_selger ? text : 'transparent',
                  color: !form.kontakt_selger ? bg : muted,
                  fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: mono, cursor: 'pointer',
                  lineHeight: 1.5
                }}>
                Book dato selv
              </button>
              <button
                onClick={() => { set('kontakt_selger', true); set('dato', ''); set('tidspunkt', '') }}
                style={{
                  flex: 1, padding: '14px 12px', border: `1px solid ${form.kontakt_selger ? text : border}`,
                  background: form.kontakt_selger ? text : 'transparent',
                  color: form.kontakt_selger ? bg : muted,
                  fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: mono, cursor: 'pointer',
                  lineHeight: 1.5
                }}>
                Vania kontakter sælger
              </button>
            </div>

            {/* Book dato selv: kalender */}
            {!form.kontakt_selger && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: text, padding: '2px 8px', fontFamily: mono }}>‹</button>
                  <div style={{ fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase' }}>{monthName}</div>
                  <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: text, padding: '2px 8px', fontFamily: mono }}>›</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
                  {['Ma','Ti','On','To','Fr','Lø','Sø'].map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: 10, color: muted, padding: '4px 0', letterSpacing: '.05em' }}>{d}</div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 20 }}>
                  {[...Array(firstDay)].map((_, i) => <div key={'e' + i} />)}
                  {[...Array(daysInMonth)].map((_, i) => {
                    const day = i + 1
                    const dayStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                    const isPast = dayStr < new Date().toISOString().split('T')[0]
                    const isOptaget = erDagOptaget(dayStr)
                    const isValgt = dayStr === form.dato
                    const disabled = isPast || isOptaget
                    return (
                      <div key={day} onClick={() => { if (!disabled) { set('dato', dayStr); set('tidspunkt', '') } }}
                        style={{
                          textAlign: 'center', padding: '8px 0', fontSize: 13, cursor: disabled ? 'default' : 'pointer',
                          background: isValgt ? text : 'transparent',
                          color: isValgt ? bg : disabled ? border : text,
                          border: `1px solid ${isValgt ? text : disabled ? 'transparent' : border}`,
                          textDecoration: isOptaget && !isPast ? 'line-through' : 'none'
                        }}>{day}</div>
                    )
                  })}
                </div>

                {form.dato && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 12, color: muted, marginBottom: 10 }}>
                      {new Date(form.dato + 'T12:00:00').toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                    {getLedigeTider(form.dato).length === 0 ? (
                      <div style={{ fontSize: 12, color: muted }}>Ingen ledige tider denne dag</div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {getLedigeTider(form.dato).map(tid => (
                          <div key={tid} onClick={() => set('tidspunkt', tid)} style={{
                            padding: '8px 16px', fontSize: 13, cursor: 'pointer',
                            border: `1px solid ${form.tidspunkt === tid ? text : border}`,
                            background: form.tidspunkt === tid ? text : 'transparent',
                            color: form.tidspunkt === tid ? bg : text
                          }}>{tid}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {!form.dato && <div style={{ fontSize: 12, color: muted, marginBottom: 24 }}>Vælg en dato i kalenderen ovenfor</div>}
              </div>
            )}

            {/* Vania kontakter sælger: telefonnummer */}
            {form.kontakt_selger && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, color: muted, marginBottom: 20, lineHeight: 1.7 }}>
                  Vi kontakter sælger direkte og aftaler et tidspunkt.<br />
                  Du modtager bekræftelse så snart tid er aftalt.
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={field.label}>Sælgers telefonnummer</label>
                  <input
                    style={field.input}
                    value={form.selger_telefon}
                    onChange={e => set('selger_telefon', e.target.value)}
                    placeholder="fx 12 34 56 78"
                    type="tel"
                  />
                </div>
              </div>
            )}

            <div style={{ marginTop: 8 }}>
              {btnBack(() => setStep(1))}
              {btn(() => setStep(3), 'Vælg pakke', !form.kontakt_selger && (!form.dato || !form.tidspunkt))}
            </div>
          </div>
        )}

        {/* Trin 3: Pakke */}
        {step === 3 && (
          <div>
            <div style={{ fontFamily: serif, fontSize: 20, marginBottom: 8 }}>Vælg pakke</div>
            <div style={{ fontSize: 12, color: muted, marginBottom: 24 }}>{form.adresse}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {pakker.map(p => (
                <div key={p.id} onClick={() => { set('pakke_id', p.id); setValgtPakke(p) }}
                  style={{
                    padding: '14px 16px', border: `1px solid ${form.pakke_id === p.id ? text : border}`,
                    background: form.pakke_id === p.id ? text : 'transparent',
                    color: form.pakke_id === p.id ? bg : text,
                    cursor: 'pointer'
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={{ fontSize: 14, fontFamily: serif }}>{p.navn}</div>
                    <div style={{ fontSize: 13 }}>{p.pris?.toLocaleString('da-DK')} kr</div>
                  </div>
                  {p.beskrivelse && <div style={{ fontSize: 11, marginTop: 4, opacity: .7 }}>{p.beskrivelse}</div>}
                </div>
              ))}
            </div>

            {tillaeg.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: muted, marginBottom: 10 }}>Tillæg</div>
                {tillaeg.map(t => (
                  <div key={t.id} onClick={() => toggleTillaeg(t.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', cursor: 'pointer', borderBottom: `1px solid ${border}` }}>
                    <div style={{ width: 16, height: 16, border: `1px solid ${form.tillaeg.includes(t.id) ? text : border}`, background: form.tillaeg.includes(t.id) ? text : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {form.tillaeg.includes(t.id) && <span style={{ color: bg, fontSize: 10 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1, fontSize: 13 }}>{t.navn}</div>
                    <div style={{ fontSize: 13, color: muted }}>+{t.pris?.toLocaleString('da-DK')} kr</div>
                  </div>
                ))}
              </div>
            )}

            {valgtPakke && (
              <div style={{ fontSize: 13, color: muted, marginBottom: 16 }}>
                Total: <span style={{ color: text, fontFamily: serif }}>{total.toLocaleString('da-DK')} kr</span> ekskl. moms
              </div>
            )}

            {btnBack(() => setStep(2))}
            {btn(() => setStep(4), 'Kontaktinfo', !form.pakke_id)}
          </div>
        )}

        {/* Trin 4: Kontaktinfo */}
        {step === 4 && (
          <div>
            <div style={{ fontFamily: serif, fontSize: 20, marginBottom: 8 }}>Dine kontaktoplysninger</div>
            <div style={{ fontSize: 12, color: muted, marginBottom: 24 }}>{form.adresse}</div>

            <div style={{ marginBottom: 14 }}>
              <label style={field.label}>Dit navn</label>
              <input style={field.input} value={maegler_navn} onChange={e => setMaeglerNavn(e.target.value)} placeholder="Navn Efternavn" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={field.label}>Email</label>
              <input style={field.input} value={form.maegler_email} onChange={e => set('maegler_email', e.target.value)} placeholder="din@email.dk" type="email" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={field.label}>Firma</label>
              <input style={field.input} value={form.maegler_firma} onChange={e => set('maegler_firma', e.target.value)} placeholder="Mæglerfirma" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={field.label}>Sagsnummer</label>
              <input style={field.input} value={form.sagsnummer} onChange={e => set('sagsnummer', e.target.value)} placeholder="" />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={field.label}>Noter</label>
              <textarea style={{ ...field.input, resize: 'vertical', minHeight: 80 }} value={form.noter} onChange={e => set('noter', e.target.value)} placeholder="Særlige ønsker eller info til fotografen" />
            </div>

            {/* Opsummering */}
            <div style={{ border: `1px solid ${border}`, padding: 16, marginBottom: 20, fontSize: 12 }}>
              <div style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: muted, marginBottom: 10 }}>Opsummering</div>
              {[
                ['Adresse', form.adresse],
                form.kontakt_selger
                  ? ['Tid', 'Vania kontakter sælger' + (form.selger_telefon ? ` (${form.selger_telefon})` : '')]
                  : ['Dato', `${form.dato ? new Date(form.dato + 'T12:00:00').toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' }) : ''} kl. ${form.tidspunkt}`],
                ['Pakke', valgtPakke?.navn],
                ...(form.tillaeg.length > 0 ? [['Tillæg', form.tillaeg.map(id => tillaeg.find(t => t.id === id)?.navn).filter(Boolean).join(', ')]] : []),
                ['Total', `${total.toLocaleString('da-DK')} kr ekskl. moms`],
              ].map(([k, v]) => v ? (
                <div key={k} style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
                  <div style={{ color: muted, minWidth: 80 }}>{k}</div>
                  <div style={{ color: text }}>{v}</div>
                </div>
              ) : null)}
            </div>

            {/* Vilkår */}
            <div style={{ fontSize: 11, color: muted, lineHeight: 1.8, marginBottom: 16, borderTop: `1px solid ${border}`, paddingTop: 16 }}>
              Betaling sker 8 dage netto fra fakturadato. Ved forsinket betaling beregnes renter i henhold til renteloven.<br /><br />
              Aflysning på fotograferingsdagen faktureres 100 % af den aftalte pris. Ændring af dato meddeles senest 48 timer før aftalt tid — ellers behandles det som aflysning.<br /><br />
              Ønskes fotografering specifikt i solskin, og dette aftales skriftligt på forhånd, gælder følgende: aflyses opgaven samme dag pga. vejret, faktureres 50 % af opgaven som fremmødegebyr. Ny dato aftales uden ekstra omkostning.
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <input type="checkbox" id="accept" checked={accepteret} onChange={e => setAccepteret(e.target.checked)} />
              <label htmlFor="accept" style={{ fontSize: 12, color: muted, cursor: 'pointer' }}>Jeg accepterer ovenstående handelsbetingelser</label>
            </div>

            {btnBack(() => setStep(3))}
            <button
              onClick={handleSend}
              disabled={sending || !accepteret || !maegler_navn || !form.maegler_email}
              style={{
                border: `1px solid ${sending || !accepteret || !maegler_navn || !form.maegler_email ? border : text}`,
                color: sending || !accepteret || !maegler_navn || !form.maegler_email ? muted : bg,
                background: sending || !accepteret || !maegler_navn || !form.maegler_email ? 'transparent' : text,
                padding: '10px 22px', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase',
                fontFamily: mono, cursor: sending || !accepteret || !maegler_navn || !form.maegler_email ? 'default' : 'pointer', marginTop: 8
              }}>
              {sending ? 'Sender...' : 'Send booking →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
