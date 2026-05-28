import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast, ToastContainer } from '../hooks/useToast'

export default function Fakturaer() {
  const [sager, setSager] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ikke-faktureret')
  const [søgning, setSøgning] = useState('')
  const [sortering, setSortering] = useState('dato_desc')
  const navigate = useNavigate()
  const { toasts, toast } = useToast()

  useEffect(() => { fetchSager() }, [filter])

  async function fetchSager() {
    setLoading(true)
    let query = supabase.from('sager')
      .select('id, adresse, dato, status, maegler_navn, maegler_firma, maegler_email, faktureret, faktureret_dato, created_at')
      .not('status', 'eq', 'ny')
      .order('dato', { ascending: false })

    if (filter === 'faktureret') query = query.eq('faktureret', true)
    if (filter === 'ikke-faktureret') query = query.or('faktureret.is.null,faktureret.eq.false')

    const { data, error } = await query
    if (error) console.error(error)
    setSager(data || [])
    setLoading(false)
  }

  async function toggleFaktureret(sag) {
    const nyVærdi = !sag.faktureret
    await supabase.from('sager').update({
      faktureret: nyVærdi,
      faktureret_dato: nyVærdi ? new Date().toISOString() : null
    }).eq('id', sag.id)
    setSager(s => s.map(x => x.id === sag.id ? { ...x, faktureret: nyVærdi, faktureret_dato: nyVærdi ? new Date().toISOString() : null } : x))
    toast(nyVærdi ? '✓ Markeret som faktureret' : '✓ Fakturering fjernet')
  }

  // Filtrer og sortér
  const filtered = sager
    .filter(s => {
      const søg = søgning.toLowerCase()
      return !søgning || (s.adresse || '').toLowerCase().includes(søg) ||
        (s.maegler_navn || '').toLowerCase().includes(søg) ||
        (s.maegler_firma || '').toLowerCase().includes(søg)
    })
    .sort((a, b) => {
      if (sortering === 'dato_desc') return new Date(b.dato) - new Date(a.dato)
      if (sortering === 'dato_asc') return new Date(a.dato) - new Date(b.dato)
      if (sortering === 'maegler') return (a.maegler_navn || '').localeCompare(b.maegler_navn || '')
      if (sortering === 'firma') return (a.maegler_firma || '').localeCompare(b.maegler_firma || '')
      return 0
    })

  // Gruppér efter mægler/firma for overblik
  const grupperetMæglere = [...new Set(sager.filter(s => !s.faktureret && s.maegler_firma).map(s => s.maegler_firma))]

  const ikkeFaktureret = sager.filter(s => !s.faktureret).length
  const faktureret = sager.filter(s => s.faktureret).length

  return (
    <div>
      <ToastContainer toasts={toasts} />
      <div className="page-title">Fakturaer</div>

      {/* STATISTIK */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#e53e3e' }}>{ikkeFaktureret}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Afventer fakturering</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#2e7d4f' }}>{faktureret}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Faktureret</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--pr)' }}>{sager.length}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sager i alt</div>
        </div>
      </div>

      {/* AFVENTER FAKTURERING PER MÆGLER */}
      {filter === 'ikke-faktureret' && grupperetMæglere.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-hd">Afventer per mæglerfirma</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {grupperetMæglere.map(firma => {
              const antal = sager.filter(s => !s.faktureret && s.maegler_firma === firma).length
              return (
                <div key={firma} style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 8, padding: '6px 12px', fontSize: 13 }}>
                  <b>{firma}</b>: {antal} sag{antal !== 1 ? 'er' : ''}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TOOLBAR */}
      <div className="toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
        <input value={søgning} onChange={e => setSøgning(e.target.value)} placeholder="🔍 Søg adresse, mægler, firma..." style={{ flex: 1, minWidth: 200 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          {['ikke-faktureret', 'faktureret', 'alle'].map(f => (
            <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(f)}>
              {f === 'ikke-faktureret' ? '⏳ Afventer' : f === 'faktureret' ? '✅ Faktureret' : 'Alle'}
            </button>
          ))}
        </div>
        <select value={sortering} onChange={e => setSortering(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--brd)', fontSize: 13, fontFamily: 'inherit' }}>
          <option value="dato_desc">Nyeste først</option>
          <option value="dato_asc">Ældste først</option>
          <option value="maegler">Mægler A-Z</option>
          <option value="firma">Firma A-Z</option>
        </select>
      </div>

      {/* LISTE */}
      <div className="card">
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Indlæser...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">🧾</div>Ingen sager fundet</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Dato</th>
                  <th>Adresse</th>
                  <th>Mægler</th>
                  <th>Firma</th>
                  <th>Status</th>
                  <th>Faktura</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                      {s.dato ? new Date(s.dato + 'T12:00:00').toLocaleDateString('da-DK') : '—'}
                    </td>
                    <td onClick={() => navigate(`/sager/${s.id}`)} style={{ cursor: 'pointer', color: 'var(--pr)', fontWeight: 500 }}>
                      {s.adresse || '—'}
                    </td>
                    <td>{s.maegler_navn || '—'}</td>
                    <td>{s.maegler_firma || '—'}</td>
                    <td>
                      <span className={`badge badge-${s.status === 'leveret' ? 'leveret' : s.status === 'aktiv' ? 'active' : 'done'}`}>
                        {({ ny: 'Ny', aktiv: 'Aktiv', afventer: 'Afventer', afsluttet: 'Afsluttet', leveret: 'Leveret' }[s.status] || s.status)}
                      </span>
                    </td>
                    <td>
                      {s.faktureret ? (
                        <div style={{ fontSize: 12, color: '#2e7d4f', fontWeight: 600 }}>
                          ✅ {s.faktureret_dato ? new Date(s.faktureret_dato).toLocaleDateString('da-DK') : ''}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: '#e53e3e' }}>⏳ Afventer</div>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-sm"
                        style={{ background: s.faktureret ? '#f0fdf4' : 'var(--pr)', color: s.faktureret ? '#2e7d4f' : '#fff', border: s.faktureret ? '1px solid #86efac' : 'none', fontSize: 11, whiteSpace: 'nowrap' }}
                        onClick={() => toggleFaktureret(s)}>
                        {s.faktureret ? '↩ Fortryd' : '🧾 Fakturer'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
