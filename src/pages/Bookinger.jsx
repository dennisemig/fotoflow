import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast, ToastContainer } from '../hooks/useToast'
import { gemKmForSag } from '../lib/km'

export default function Bookinger() {
  const [bookinger, setBookinger] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('afventer')
  const [holdDialog, setHoldDialog] = useState(null) // booking object
  const [holdBemærkning, setHoldBemærkning] = useState('')
  const navigate = useNavigate()
  const { toasts, toast } = useToast()

  useEffect(() => { fetchBookinger() }, [filter])

  async function fetchBookinger() {
    setLoading(true)
    let query = supabase.from('bookings').select('*').order('created_at', { ascending: false })
    if (filter !== 'alle') query = query.eq('status', filter)
    const { data, error } = await query
    if (error) console.error('Bookinger fejl:', error)
    setBookinger(data || [])
    setLoading(false)
  }

  async function godkend(booking) {
    // Slå kunde op via maegler_firma
    let kunde_id = null
    if (booking.maegler_firma) {
      const { data: kundeMatch } = await supabase
        .from('kunder')
        .select('id')
        .ilike('navn', `%${booking.maegler_firma}%`)
        .limit(1)
        .single()
      if (kundeMatch) kunde_id = kundeMatch.id
    }

    // Opret sag fra booking med mægler-info
    const { data: sag, error } = await supabase.from('sager').insert([{
      adresse: booking.adresse,
      dato: booking.dato,
      tidspunkt: booking.tidspunkt,
      type: 'ejendom',
      status: 'ny',
      noter: booking.noter,
      bbr_data: booking.bbr_data,
      maegler_navn: booking.maegler_navn,
      maegler_email: booking.maegler_email,
      maegler_firma: booking.maegler_firma,
      kunde_id: kunde_id,
      maegler_sagsnummer: booking.sagsnummer || null,
      pakke: booking.pakke || null,
      tillaeg: booking.tillaeg || [],
    }]).select().single()

    if (error) { toast('Fejl ved oprettelse af sag: ' + error.message, 'error'); return }

    // Beregn km til kørselsrapporten (i baggrunden)
    gemKmForSag(sag.id, booking.adresse)

    // Opdater booking status
    await supabase.from('bookings').update({ status: 'godkendt', sag_id: sag.id }).eq('id', booking.id)

    // Send bekræftelsesmail til mægler
    await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'booking_bekraeft',
        mægler: {
          email: booking.maegler_email,
          maegler_navn: booking.maegler_navn,
          adresse: booking.adresse,
          dato: booking.dato ? new Date(booking.dato + 'T12:00:00').toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '',
          tidspunkt: booking.tidspunkt,
          pakke: booking.pakke,
          tillaeg: (booking.tillaeg || []).join(', '),
        }
      })
    }).catch(() => {})

    toast('✓ Booking godkendt – sag oprettet og bekræftelsesmail sendt!')
    fetchBookinger()
  }

  async function sætPåHold(booking, bemærkning) {
    await supabase.from('bookings').update({ status: 'afventer_selger', hold_bemærkning: bemærkning || null }).eq('id', booking.id)

    await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'booking_afventer_selger',
        mægler: {
          email: booking.maegler_email,
          maegler_navn: booking.maegler_navn,
          adresse: booking.adresse,
          bemærkning: bemærkning || null,
        }
      })
    }).catch(() => {})

    setHoldDialog(null)
    setHoldBemærkning('')
    toast('Booking sat på hold — mægler er notificeret')
    fetchBookinger()
  }

  async function afvis(booking) {
    if (!confirm('Er du sikker på at du vil afvise denne booking?')) return
    await supabase.from('bookings').update({ status: 'afvist' }).eq('id', booking.id)

    // Send afvisningsmail til mægler
    await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'booking_afvist',
        mægler: {
          email: booking.maegler_email,
          maegler_navn: booking.maegler_navn,
          adresse: booking.adresse,
          dato: booking.dato ? new Date(booking.dato + 'T12:00:00').toLocaleDateString('da-DK') : '',
        }
      })
    }).catch(() => {})

    toast('Booking afvist')
    fetchBookinger()
  }

  const statusBadge = s => ({
    afventer: <span className="badge badge-pending">Afventer</span>,
    afventer_selger: <span className="badge" style={{ background: '#fff3cd', color: '#856404', border: '1px solid #ffc107' }}>På hold</span>,
    godkendt: <span className="badge badge-active">Godkendt</span>,
    afvist: <span className="badge badge-new">Afvist</span>
  }[s] || <span className="badge badge-pending">Afventer</span>)

  const afventerCount = bookinger.filter(b => b.status === 'afventer').length

  return (
    <div>
      <ToastContainer toasts={toasts} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div className="page-title" style={{ margin: 0 }}>Bookinger fra mæglere</div>
        {afventerCount > 0 && (
          <div style={{ background: 'var(--red-bg)', color: 'var(--red)', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
            {afventerCount} afventer godkendelse
          </div>
        )}
      </div>

      <div className="toolbar">
        {[['afventer','Afventer'], ['afventer_selger','På hold'], ['godkendt','Godkendt'], ['afvist','Afvist'], ['alle','Alle']].map(([val, label]) => (
          <button key={val} className={`btn btn-sm ${filter === val ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(val)}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Indlæser...</div>
      ) : bookinger.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            {filter === 'afventer' ? 'Ingen bookinger afventer godkendelse' : 'Ingen bookinger i denne kategori'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {bookinger.map(b => (
            <div key={b.id} className="card">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--pr)', marginBottom: 4 }}>{b.adresse}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Modtaget {new Date(b.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                {statusBadge(b.status)}
              </div>

              {b.kontakt_selger && (
                <div style={{ background: '#1a1a1a', color: '#e8e4de', padding: '10px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 14 }}>
                  ⚠️ Afventer tidspunkt — vi kontakter sælger
                </div>
              )}

              <div className="grid2" style={{ marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8, fontWeight: 600 }}>Ejendom & tid</div>
                  {b.kontakt_selger ? (
                    <>
                      <div style={{ fontSize: 13, marginBottom: 4 }}>📅 —</div>
                      <div style={{ fontSize: 13, marginBottom: 4 }}>👤 Sælger: <b>{b.selger_navn || '—'}</b></div>
                      <div style={{ fontSize: 13, marginBottom: 4 }}>📞 <a href={`tel:${b.selger_telefon}`} style={{ color: 'var(--pr)' }}>{b.selger_telefon || '—'}</a></div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 13, marginBottom: 4 }}>📅 {b.dato ? new Date(b.dato + 'T12:00:00').toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</div>
                      <div style={{ fontSize: 13, marginBottom: 4 }}>⏰ kl. {b.tidspunkt || '—'}</div>
                    </>
                  )}
                  <div style={{ fontSize: 13, marginBottom: 4 }}>📦 {b.pakke || '—'}</div>
                  {b.sagsnummer && <div style={{ fontSize: 13, marginBottom: 4 }}>🔑 Sagsnr: <b>{b.sagsnummer}</b></div>}
                  {(b.tillaeg || []).length > 0 && (
                    <div style={{ fontSize: 13 }}>➕ {b.tillaeg.join(', ')}</div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8, fontWeight: 600 }}>Mægler</div>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>👤 <b>{b.maegler_navn || '—'}</b></div>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>🏢 {b.maegler_firma || '—'}</div>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>✉ <a href={`mailto:${b.maegler_email}`} style={{ color: 'var(--pr)' }}>{b.maegler_email || '—'}</a></div>
                </div>
              </div>

              {b.noter && (
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14, borderLeft: '3px solid var(--pr)' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' }}>Note fra mægler</div>
                  {b.noter}
                </div>
              )}

              {b.hold_bemærkning && (
                <div style={{ background: '#fff8e1', border: '1px solid #ffc107', borderRadius: 6, padding: '8px 14px', fontSize: 13, marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: '#856404', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' }}>Bemærkning (sendt til mægler)</div>
                  {b.hold_bemærkning}
                </div>
              )}

              {b.status === 'afventer' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-green" onClick={() => godkend(b)}>✓ Godkend – opret sag</button>
                  <button className="btn btn-outline" onClick={() => { setHoldDialog(b); setHoldBemærkning('') }}>⏸ Sæt på hold</button>
                  <button className="btn btn-red" onClick={() => afvis(b)}>✕ Afvis</button>
                </div>
              )}

              {b.status === 'afventer_selger' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-green" onClick={() => godkend(b)}>✓ Godkend – opret sag</button>
                  <button className="btn btn-red" onClick={() => afvis(b)}>✕ Afvis</button>
                </div>
              )}

              {b.status === 'godkendt' && b.sag_id && (
                <button className="btn btn-outline btn-sm" onClick={() => navigate('/sager/' + b.sag_id)}>Se oprettet sag →</button>
              )}

              {b.status === 'afvist' && (
                <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>Booking afvist – mægler er notificeret</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* HOLD DIALOG */}
      {holdDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--card-bg, #fff)', borderRadius: 10, padding: 28, maxWidth: 440, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Sæt på hold</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>{holdDialog.adresse}</div>
            <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: 6, fontWeight: 600 }}>
              Bemærkning til mægler
            </label>
            <textarea
              rows={4}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border, #ddd)', borderRadius: 6, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
              placeholder="fx: Sælger ønsker at blive kontaktet igen om 10 dage."
              value={holdBemærkning}
              onChange={e => setHoldBemærkning(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn btn-primary" onClick={() => sætPåHold(holdDialog, holdBemærkning)}>Send til mægler</button>
              <button className="btn btn-outline" onClick={() => setHoldDialog(null)}>Annuller</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}