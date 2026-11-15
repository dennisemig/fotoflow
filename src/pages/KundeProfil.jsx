import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast, ToastContainer } from '../hooks/useToast'
import { hentMaeglere, gemMaegler, sletMaegler, normEmail } from '../lib/maeglere'

export default function KundeProfil() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [kunde, setKunde] = useState(null)
  const [sager, setSager] = useState([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [mwForm, setMwForm] = useState({ mindworking_shopno: '', mindworking_endpoint: '', mindworking_token_url: '', mindworking_secret: '' })
  const [savingMw, setSavingMw] = useState(false)
  const [maeglere, setMaeglere] = useState([])
  const [maeglerForm, setMaeglerForm] = useState(null) // null = lukket, {} = ny, {id,...} = rediger
  const [savingMaegler, setSavingMaegler] = useState(false)
  const { toasts, toast } = useToast()

  useEffect(() => {
    supabase.from('kunder').select('*').eq('id', id).single().then(({ data }) => {
      setKunde(data)
      setForm(data || {})
      setMwForm({
        mindworking_shopno: data?.mindworking_shopno || '',
        mindworking_endpoint: data?.mindworking_endpoint || '',
        mindworking_token_url: data?.mindworking_token_url || '',
        mindworking_secret: data?.mindworking_secret || ''
      })
    })
    hentMaeglere(id).then(setMaeglere)
    supabase.from('sager').select('id, adresse, dato, status, maegler_navn, maegler_email, created_at').eq('kunde_id', id).order('dato', { ascending: false }).then(({ data }) => setSager(data || []))
  }, [id])

  async function handleSave() {
    setSaving(true)
    await supabase.from('kunder').update({
      navn: form.navn, email: form.email, telefon: form.telefon, noter: form.noter,
      tags: typeof form.tags === 'string' ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : (form.tags || [])
    }).eq('id', id)
    setSaving(false); setEditing(false)
    supabase.from('kunder').select('*').eq('id', id).single().then(({ data }) => setKunde(data))
    toast('✓ Kunde opdateret')
  }

  async function handleSaveMw() {
    setSavingMw(true)
    await supabase.from('kunder').update({
      mindworking_shopno: mwForm.mindworking_shopno || null,
      mindworking_endpoint: mwForm.mindworking_endpoint || null,
      mindworking_token_url: mwForm.mindworking_token_url || null,
      mindworking_secret: mwForm.mindworking_secret || null
    }).eq('id', id)
    setSavingMw(false)
    supabase.from('kunder').select('*').eq('id', id).single().then(({ data }) => setKunde(data))
    toast('✓ Mindworking indstillinger gemt')
  }

  async function handleSaveMaegler() {
    const f = maeglerForm
    if (!f.navn?.trim()) { toast('Skriv mæglerens navn', 'error'); return }
    const mail = normEmail(f.email)
    if (mail && maeglere.some(m => m.email === mail && m.id !== f.id)) { toast('Der findes allerede en mægler med den email', 'error'); return }
    setSavingMaegler(true)
    const { error } = await gemMaegler(id, f)
    setSavingMaegler(false)
    if (error) { toast('Kunne ikke gemme: ' + error.message, 'error'); return }
    setMaeglerForm(null)
    setMaeglere(await hentMaeglere(id))
    toast(f.id ? '✓ Mægler opdateret' : '✓ Mægler tilføjet')
  }

  async function handleDeleteMaegler(m) {
    if (!confirm(`Fjern ${m.navn} fra kundens mæglere?`)) return
    const { error } = await sletMaegler(m.id)
    if (error) { toast('Kunne ikke fjerne: ' + error.message, 'error'); return }
    setMaeglere(ms => ms.filter(x => x.id !== m.id))
    toast('Mægler fjernet')
  }

  async function handleDelete() {
    if (!confirm('Slet kunden? Dette kan ikke fortrydes.')) return
    await supabase.from('kunder').delete().eq('id', id)
    navigate('/kunder')
  }

  if (!kunde) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Indlæser...</div>

  const statusLabel = s => ({ ny: 'Ny', aktiv: 'Aktiv', afventer: 'Afventer', afsluttet: 'Afsluttet', leveret: 'Leveret' }[s] || 'Ny')
  const badgeClass = s => ({ aktiv: 'active', afventer: 'pending', ny: 'new', afsluttet: 'done', leveret: 'leveret' }[s] || 'new')

  const mwKonfigureret = kunde.mindworking_shopno

  // Mæglere fra kundens sager, som ikke står på listen endnu (nyeste først)
  const kendteEmails = new Set(maeglere.map(m => m.email))
  const forslag = []
  for (const s of [...sager].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))) {
    const mail = normEmail(s.maegler_email)
    if (!mail || kendteEmails.has(mail)) continue
    kendteEmails.add(mail)
    forslag.push({ navn: s.maegler_navn || '', email: mail })
  }
  const lbl = { fontSize: 11, color: 'var(--muted)' }

  return (
    <div>
      <ToastContainer toasts={toasts} />
      <div className="back-link" onClick={() => navigate('/kunder')}>← Tilbage til kunder</div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--pr)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700 }}>
            {kunde.navn?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            {editing
              ? <input value={form.navn || ''} onChange={e => setForm(f => ({ ...f, navn: e.target.value }))} style={{ fontSize: 18, fontWeight: 700, color: 'var(--pr)', border: '1px solid var(--brd)', borderRadius: 7, padding: '4px 8px', width: '100%' }} />
              : <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--pr)' }}>{kunde.navn}</div>
            }
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{kunde.telefon} · {kunde.email}</div>
            <div style={{ marginTop: 6 }}>{(kunde.tags || []).map(t => <span key={t} className="tag">{t}</span>)}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {editing
              ? <><button className="btn btn-green btn-sm" onClick={handleSave} disabled={saving}>{saving ? 'Gemmer...' : 'Gem'}</button><button className="btn btn-outline btn-sm" onClick={() => setEditing(false)}>Annuller</button></>
              : <><button className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>✏ Rediger</button><button className="btn btn-red btn-sm" onClick={handleDelete}>Slet</button></>
            }
          </div>
        </div>
        {editing && (
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group"><label>Email</label><input value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div className="form-group"><label>Telefon</label><input value={form.telefon || ''} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} /></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Tags (kommasepareret)</label><input value={Array.isArray(form.tags) ? form.tags.join(', ') : (form.tags || '')} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} /></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Noter</label><textarea rows={3} value={form.noter || ''} onChange={e => setForm(f => ({ ...f, noter: e.target.value }))} /></div>
          </div>
        )}
      </div>

      <div className="grid2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* MÆGLERE (medarbejdere hos kunden) */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="section-hd" style={{ margin: 0 }}>Mæglere ({maeglere.length})</div>
              {!maeglerForm && <button className="btn btn-outline btn-sm" onClick={() => setMaeglerForm({ navn: '', email: '', telefon: '' })}>+ Tilføj mægler</button>}
            </div>

            {maeglerForm && (
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group" style={{ gridColumn: '1/-1', marginBottom: 0 }}><label>Navn *</label><input autoFocus value={maeglerForm.navn || ''} onChange={e => setMaeglerForm(f => ({ ...f, navn: e.target.value }))} /></div>
                  <div className="form-group" style={{ marginBottom: 0 }}><label>Email</label><input type="email" value={maeglerForm.email || ''} onChange={e => setMaeglerForm(f => ({ ...f, email: e.target.value }))} /></div>
                  <div className="form-group" style={{ marginBottom: 0 }}><label>Telefon</label><input value={maeglerForm.telefon || ''} onChange={e => setMaeglerForm(f => ({ ...f, telefon: e.target.value }))} /></div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button className="btn btn-green btn-sm" onClick={handleSaveMaegler} disabled={savingMaegler}>{savingMaegler ? 'Gemmer...' : 'Gem'}</button>
                  <button className="btn btn-outline btn-sm" onClick={() => setMaeglerForm(null)}>Annuller</button>
                </div>
              </div>
            )}

            {maeglere.length === 0 && !maeglerForm && (
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>Ingen mæglere endnu. Tilføj de medarbejdere, der bestiller billeder, så du kan vælge den rigtige på sagen.</div>
            )}
            {maeglere.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '.5px solid var(--brd)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{m.navn}</div>
                  <div style={lbl}>{[m.email, m.telefon].filter(Boolean).join(' · ') || 'Ingen email'}</div>
                </div>
                <button className="btn btn-outline btn-sm" onClick={() => setMaeglerForm({ ...m, email: m.email || '', telefon: m.telefon || '' })}>✏</button>
                <button className="btn btn-outline btn-sm" onClick={() => handleDeleteMaegler(m)} title="Fjern">✕</button>
              </div>
            ))}

            {forslag.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ ...lbl, marginBottom: 6 }}>Fra kundens tidligere sager:</div>
                {forslag.map(f => (
                  <div key={f.email} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 12 }}>{f.navn || '—'} <span style={{ color: 'var(--muted)' }}>· {f.email}</span></div>
                    <button className="btn btn-outline btn-sm" onClick={() => setMaeglerForm({ navn: f.navn, email: f.email, telefon: '' })}>+ Tilføj</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="section-hd">Sager ({sager.length})</div>
            {sager.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>Ingen sager endnu</div>
              : sager.map(s => (
                <div key={s.id} onClick={() => navigate(`/sager/${s.id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '.5px solid var(--brd)', cursor: 'pointer' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{s.adresse}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.dato ? new Date(s.dato).toLocaleDateString('da-DK') : '—'}</div>
                  </div>
                  <span className={`badge badge-${badgeClass(s.status)}`}>{statusLabel(s.status)}</span>
                </div>
              ))
            }
          </div>

          <div className="card">
            <div className="section-hd">Noter</div>
            <div style={{ fontSize: 13, color: kunde.noter ? 'var(--txt)' : 'var(--muted)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {kunde.noter || 'Ingen noter. Klik Rediger for at tilføje.'}
            </div>
          </div>
        </div>

        {/* MINDWORKING INDSTILLINGER */}
        <div className="card">
          <div className="section-hd">Mindworking</div>

          {mwKonfigureret && (
            <div className="ok-box" style={{ marginBottom: 14 }}>✓ Mindworking er konfigureret (Shop No: {kunde.mindworking_shopno})</div>
          )}

          <div className="form-group">
            <label>Shop No</label>
            <input
              value={mwForm.mindworking_shopno}
              onChange={e => setMwForm(f => ({ ...f, mindworking_shopno: e.target.value }))}
              placeholder="f.eks. N260142 eller N270192"
            />
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              Findes på Mindworking-kontoret. Påkrævet for at sende billeder.
            </div>
          </div>

          <div className="form-group">
            <label>API Endpoint <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(valgfri — bruges kun hvis afdelingen har eget endpoint)</span></label>
            <input
              value={mwForm.mindworking_endpoint}
              onChange={e => setMwForm(f => ({ ...f, mindworking_endpoint: e.target.value }))}
              placeholder="https://nybolig.mindworking.eu/api/integrations/media/graphql/"
            />
          </div>

          <div className="form-group">
            <label>Token URL <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(valgfri)</span></label>
            <input
              value={mwForm.mindworking_token_url}
              onChange={e => setMwForm(f => ({ ...f, mindworking_token_url: e.target.value }))}
              placeholder="https://iam.mindworking.eu/auth/realms/nybolig/protocol/openid-connect/token"
            />
          </div>

          <div className="form-group">
            <label>Client Secret <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(valgfri)</span></label>
            <input
              type="password"
              value={mwForm.mindworking_secret}
              onChange={e => setMwForm(f => ({ ...f, mindworking_secret: e.target.value }))}
              placeholder="Kun hvis afdelingen har egen secret"
            />
          </div>

          <button className="btn btn-primary btn-sm" onClick={handleSaveMw} disabled={savingMw}>
            {savingMw ? 'Gemmer...' : '💾 Gem Mindworking indstillinger'}
          </button>
        </div>
      </div>
    </div>
  )
}
