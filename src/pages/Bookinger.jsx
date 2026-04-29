import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast, ToastContainer } from '../hooks/useToast'

export default function Bookinger() {
  const [bookinger, setBookinger] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('afventer')
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
    }]).select().single()

    if (error) { toast('Fejl ved oprettelse af sag: ' + error.message, 'error'); return }

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
        {['afventer', 'godkendt', 'afvist', 'alle'].map(f => (
          <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
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

              <div className="grid2" style={{ marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8, fontWeight: 600 }}>Ejendom & tid</div>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>📅 {b.dato ? new Date(b.dato + 'T12:00:00').toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</div>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>⏰ kl. {b.tidspunkt || '—'}</div>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>📦 {b.pakke || '—'}</div>
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

              {b.status === 'afventer' && (
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
    </div>
  )
}
