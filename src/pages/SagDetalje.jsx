import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast, ToastContainer } from '../hooks/useToast'

const TYPES = ['ejendom', 'portræt', 'bryllup', 'event', 'mode', 'produkt']
const CHUNK = 10 * 1024 * 1024 // 10MB chunks - under Vercel limit

export default function SagDetalje() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [sag, setSag] = useState(null)
  const [kunde, setKunde] = useState(null)
  const [freelancer, setFreelancer] = useState(null)
  const [freelancere, setFreelancere] = useState([])
  const [kunder, setKunder] = useState([])
  const [noter, setNoter] = useState('')
  const [mwNummer, setMwNummer] = useState('')
  const [saving, setSaving] = useState(false)
  const [showBookModal, setShowBookModal] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [uploads, setUploads] = useState([])
  const [uploading, setUploading] = useState(false)
  const [fileProgress, setFileProgress] = useState({})
  const fileInputRef = useRef()
  const { toasts, toast } = useToast()

  useEffect(() => {
    fetchSag(); fetchFreelancere(); fetchKunder(); fetchUploads()
  }, [id])

  async function fetchSag() {
    const { data } = await supabase.from('sager').select('*').eq('id', id).single()
    if (!data) return
    setSag(data); setNoter(data.noter || ''); setMwNummer(data.mindworking_sagsnummer || '')
    setEditForm({ adresse: data.adresse || '', dato: data.dato || '', tidspunkt: data.tidspunkt ? String(data.tidspunkt).slice(0,5) : '', type: data.type || 'ejendom', maks_billeder: data.maks_billeder || 20, kunde_id: data.kunde_id || '', freelancer_id: data.freelancer_id || '' })
    if (data.kunde_id) { const { data: k } = await supabase.from('kunder').select('*').eq('id', data.kunde_id).single(); setKunde(k) }
    if (data.freelancer_id) { const { data: f } = await supabase.from('freelancere').select('*').eq('id', data.freelancer_id).single(); setFreelancer(f) }
  }
  async function fetchFreelancere() { const { data } = await supabase.from('freelancere').select('id, navn, email').eq('aktiv', true); setFreelancere(data || []) }
  async function fetchKunder() { const { data } = await supabase.from('kunder').select('id, navn').order('navn'); setKunder(data || []) }
  async function fetchUploads() { const { data } = await supabase.from('uploads').select('*').eq('sag_id', id).order('uploaded_at', { ascending: false }); setUploads(data || []) }

  async function dbxCall(action, apiArg, body) {
    const headers = { 'Action': action }
    if (apiArg) headers['Dropbox-API-Arg'] = JSON.stringify(apiArg)
    if (typeof body === 'string') headers['Content-Type'] = 'application/json'
    const r = await fetch('/api/dropbox-upload', { method: 'POST', headers, body })
    if (!r.ok) { const e = await r.json(); throw new Error(e.error || e.error_summary || 'Dropbox fejl') }
    return r.headers.get('content-type')?.includes('json') ? r.json() : r
  }

  async function uploadFiles(files) {
    if (!files?.length) return
    setUploading(true)
    const sagNavn = sag?.adresse?.replace(/[^a-zA-Z0-9æøåÆØÅ ]/g, '_').trim() || id

    for (const file of Array.from(files)) {
      setFileProgress(p => ({ ...p, [file.name]: 1 }))
      try {
        const path = `/VaniaGraphics/Sager/${sagNavn}/${file.name}`

        if (file.size <= CHUNK) {
          // Lille fil – direkte upload
          const buf = await file.arrayBuffer()
          const res = await dbxCall('upload', { path, mode: 'overwrite', autorename: true }, buf)
          await saveUpload(file, res.path_display)
        } else {
          // Stor fil – chunked session
          const firstBuf = await file.slice(0, CHUNK).arrayBuffer()
          const { session_id } = await dbxCall('start', { close: false }, firstBuf)
          setFileProgress(p => ({ ...p, [file.name]: 5 }))

          let offset = CHUNK
          while (offset + CHUNK < file.size) {
            const chunk = await file.slice(offset, offset + CHUNK).arrayBuffer()
            await dbxCall('append', { cursor: { session_id, offset }, close: false }, chunk)
            offset += CHUNK
            setFileProgress(p => ({ ...p, [file.name]: Math.round(offset / file.size * 90) }))
          }

          const lastBuf = await file.slice(offset).arrayBuffer()
          const res = await dbxCall('finish', { cursor: { session_id, offset }, commit: { path, mode: 'overwrite', autorename: true } }, lastBuf)
          await saveUpload(file, res.path_display)
        }

        setFileProgress(p => ({ ...p, [file.name]: 100 }))
        toast(`✓ ${file.name} uploadet!`)
      } catch (e) {
        console.error(e)
        toast(`Fejl: ${file.name}`, 'error')
        setFileProgress(p => ({ ...p, [file.name]: -1 }))
      }
    }
    setUploading(false); fetchUploads()
    setTimeout(() => setFileProgress({}), 4000)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function saveUpload(file, dropboxPath) {
    await supabase.from('uploads').insert([{
      sag_id: id, filnavn: file.name, dropbox_path: dropboxPath,
      type: /\.(cr2|cr3|nef|arw|dng|raw|rw2)$/i.test(file.name) ? 'raw' : file.type.startsWith('image/') ? 'billede' : 'fil',
      uploaded_at: new Date().toISOString()
    }])
  }

  async function openFile(path) {
    try {
      const d = await dbxCall('link', null, JSON.stringify({ path }))
      if (d.link) window.open(d.link, '_blank')
    } catch (e) { toast('Kunne ikke åbne fil', 'error') }
  }

  async function deleteUpload(upload) {
    if (!confirm(`Slet ${upload.filnavn}?`)) return
    try {
      await dbxCall('delete', null, JSON.stringify({ path: upload.dropbox_path }))
      await supabase.from('uploads').delete().eq('id', upload.id)
      setUploads(u => u.filter(x => x.id !== upload.id))
      toast('Fil slettet')
    } catch (e) { toast('Fejl ved sletning', 'error') }
  }

  async function saveEdit() {
    setSaving(true)
    await supabase.from('sager').update({ adresse: editForm.adresse, dato: editForm.dato, tidspunkt: editForm.tidspunkt || null, type: editForm.type, maks_billeder: editForm.maks_billeder, kunde_id: editForm.kunde_id || null, freelancer_id: editForm.freelancer_id || null }).eq('id', id)
    setSaving(false); setEditing(false); fetchSag(); toast('✓ Sag opdateret')
  }
  async function saveNoter() { setSaving(true); await supabase.from('sager').update({ noter }).eq('id', id); setSaving(false); toast('✓ Noter gemt') }
  async function saveMwNummer() { await supabase.from('sager').update({ mindworking_sagsnummer: mwNummer }).eq('id', id); setSag(s => ({ ...s, mindworking_sagsnummer: mwNummer })); toast('✓ Gemt') }
  async function updateStatus(status) { await supabase.from('sager').update({ status }).eq('id', id); setSag(s => ({ ...s, status })); toast('✓ Status opdateret') }
  async function sletSag() { if (!confirm('Slet sagen permanent?')) return; await supabase.from('sager').delete().eq('id', id); navigate('/sager') }
  async function bookFreelancer(fId) { const fl = freelancere.find(f => f.id === fId); await supabase.from('sager').update({ freelancer_id: fId }).eq('id', id); setFreelancer(fl); setSag(s => ({ ...s, freelancer_id: fId })); setShowBookModal(false); toast(`✓ ${fl?.navn} booket!`) }
  async function fjernFreelancer() { await supabase.from('sager').update({ freelancer_id: null }).eq('id', id); setFreelancer(null); setSag(s => ({ ...s, freelancer_id: null })); toast('Fjernet') }

  if (!sag) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Indlæser...</div>

  const statusLabel = s => ({ ny: 'Ny', aktiv: 'Aktiv', afventer: 'Afventer', afsluttet: 'Afsluttet', leveret: 'Leveret' }[s] || 'Ny')
  const badgeClass = s => ({ aktiv: 'active', afventer: 'pending', leveret: 'leveret', ny: 'new', afsluttet: 'done' }[s] || 'new')
  const initials = n => n?.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase() || '?'
  const set = (k, v) => setEditForm(f => ({ ...f, [k]: v }))
  const fileIcon = t => t === 'raw' ? '📷' : t === 'billede' ? '🖼' : '📄'

  return (
    <div>
      <ToastContainer toasts={toasts} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="back-link" style={{ margin: 0 }} onClick={() => navigate('/sager')}>← Tilbage til sager</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={() => setEditing(!editing)}>{editing ? 'Annuller' : '✏ Rediger sag'}</button>
          <button className="btn btn-red btn-sm" onClick={sletSag}>🗑 Slet</button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div className="page-title" style={{ margin: 0 }}>{sag.adresse}</div>
        <span className={`badge badge-${badgeClass(sag.status)}`}>{statusLabel(sag.status)}</span>
      </div>

      {editing && (
        <div className="card" style={{ marginBottom: 16, border: '2px solid var(--pr)' }}>
          <div className="section-hd">Rediger sag</div>
          <div className="form-group"><label>Adresse</label><input value={editForm.adresse} onChange={e => set('adresse', e.target.value)} /></div>
          <div className="form-group"><label>Kunde</label><select value={editForm.kunde_id} onChange={e => set('kunde_id', e.target.value)}><option value="">— Ingen —</option>{kunder.map(k => <option key={k.id} value={k.id}>{k.navn}</option>)}</select></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group"><label>Dato</label><input type="date" value={editForm.dato} onChange={e => set('dato', e.target.value)} /></div>
            <div className="form-group"><label>Tidspunkt</label><input type="time" value={editForm.tidspunkt} onChange={e => set('tidspunkt', e.target.value)} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group"><label>Type</label><select value={editForm.type} onChange={e => set('type', e.target.value)}>{TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}</select></div>
            <div className="form-group"><label>Maks billeder</label><input type="number" value={editForm.maks_billeder} onChange={e => set('maks_billeder', parseInt(e.target.value))} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-green" onClick={saveEdit} disabled={saving}>{saving ? 'Gemmer...' : '✓ Gem'}</button>
            <button className="btn btn-outline" onClick={() => setEditing(false)}>Annuller</button>
          </div>
        </div>
      )}

      <div className="grid2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="section-hd">Sagsdetaljer</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              {[
                { lbl: 'Dato', val: sag.dato ? new Date(sag.dato + 'T12:00:00').toLocaleDateString('da-DK') : '—' },
                { lbl: 'Tidspunkt', val: sag.tidspunkt ? String(sag.tidspunkt).slice(0,5) : '—' },
                { lbl: 'Type', val: sag.type || '—' },
                { lbl: 'Maks billeder', val: sag.maks_billeder || 20 },
              ].map((r, i) => (
                <div key={i}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>{r.lbl}</div>
                  <div style={{ fontWeight: 500, textTransform: 'capitalize' }}>{r.val}</div>
                </div>
              ))}
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => window.open(`https://maps.google.com?q=${encodeURIComponent(sag.adresse)}`)}>📍 Google Maps</button>
          </div>

          {kunde && (
            <div className="card">
              <div className="section-hd">Kundeinfo</div>
              <div style={{ marginBottom: 6 }}><div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Navn</div><div style={{ fontWeight: 600 }}>{kunde.navn}</div></div>
              <div style={{ marginBottom: 6 }}><div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Telefon</div><div>{kunde.telefon || '—'}</div></div>
              <div style={{ marginBottom: 10 }}><div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Email</div><div style={{ color: 'var(--pr)' }}>{kunde.email || '—'}</div></div>
              <button className="btn btn-outline btn-sm" onClick={() => navigate(`/kunder/${kunde.id}`)}>Se kundeprofil →</button>
            </div>
          )}

          <div className="card">
            <div className="section-hd">Opdater status</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['ny','aktiv','afventer','afsluttet','leveret'].map(s => (
                <button key={s} onClick={() => updateStatus(s)} className={`btn btn-sm ${sag.status === s ? 'btn-primary' : 'btn-outline'}`}>{statusLabel(s)}</button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="section-hd">Mindworking</div>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label>Mindworking sagsnummer</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={mwNummer} onChange={e => setMwNummer(e.target.value)} placeholder="f.eks. MW-2024-1234" style={{ flex: 1 }} />
                <button className="btn btn-primary btn-sm" onClick={saveMwNummer}>Gem</button>
              </div>
            </div>
            {mwNummer ? <div className="ok-box" style={{ marginBottom: 10 }}>✓ Sagsnummer gemt</div> : <div className="warn-box" style={{ marginBottom: 10 }}>⏳ Indtast sagsnummer fra Mindworking</div>}
            <button className="btn btn-sm" style={{ background: mwNummer ? 'var(--pr)' : '#8fa8bc', color: '#fff', opacity: mwNummer ? 1 : 0.6, cursor: mwNummer ? 'pointer' : 'not-allowed' }} disabled={!mwNummer}>⚡ Send til Mindworking</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="section-hd">Tilknyttet freelancer</div>
            {freelancer ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, marginBottom: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--pr)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>{initials(freelancer.navn)}</div>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{freelancer.navn}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{freelancer.email}</div></div>
                  <span className="badge badge-active">Booket</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => setShowBookModal(true)}>Skift</button>
                  <button className="btn btn-red btn-sm" onClick={fjernFreelancer}>Fjern</button>
                </div>
              </>
            ) : (
              <><div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 10 }}>Ingen freelancer booket</div><button className="btn btn-primary btn-sm" onClick={() => setShowBookModal(true)}>+ Book freelancer</button></>
            )}
          </div>

          <div className="card">
            <div className="section-hd">Noter</div>
            <textarea value={noter} onChange={e => setNoter(e.target.value)} style={{ width: '100%', minHeight: 80, padding: 10, border: '1px solid var(--brd)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} placeholder="Skriv noter til sagen..." />
            <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={saveNoter} disabled={saving}>{saving ? 'Gemmer...' : 'Gem noter'}</button>
          </div>

          <div className="card">
            <div className="section-hd">Filer & billeder (Dropbox)</div>
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--pr)' }}
              onDragLeave={e => e.currentTarget.style.borderColor = '#c5d3dc'}
              onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#c5d3dc'; if (!uploading) uploadFiles(e.dataTransfer.files) }}
              style={{ border: '2px dashed #c5d3dc', borderRadius: 12, padding: 20, textAlign: 'center', cursor: uploading ? 'default' : 'pointer', marginBottom: 12 }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{uploading ? '⏳' : '📂'}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                {uploading
                  ? <strong style={{ color: 'var(--pr)' }}>Uploader til Dropbox...</strong>
                  : <><strong style={{ color: 'var(--pr)' }}>Klik eller træk filer hertil</strong><br /><span style={{ fontSize: 11 }}>RAW, JPG, PNG – ingen størrelsesgrænse · gemmes i /VaniaGraphics/Sager/</span></>
                }
              </div>
            </div>
            <input ref={fileInputRef} type="file" multiple accept="image/*,.raw,.cr2,.cr3,.nef,.arw,.dng,.rw2" style={{ display: 'none' }} onChange={e => uploadFiles(e.target.files)} />

            {Object.keys(fileProgress).length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {Object.entries(fileProgress).map(([name, pct]) => (
                  <div key={name} style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{name}</span>
                      <span style={{ color: pct < 0 ? 'var(--red)' : pct === 100 ? 'var(--grn)' : 'var(--muted)', fontWeight: 600 }}>{pct < 0 ? 'Fejl' : pct === 100 ? '✓' : `${pct}%`}</span>
                    </div>
                    <div style={{ height: 4, background: '#e8edf1', borderRadius: 4 }}>
                      <div style={{ height: '100%', width: `${Math.max(0, pct)}%`, background: pct < 0 ? 'var(--red)' : pct === 100 ? 'var(--grn)' : 'var(--pr)', borderRadius: 4, transition: 'width .3s' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {uploads.length > 0 ? (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Uploadede filer ({uploads.length})</div>
                {uploads.map(u => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '.5px solid var(--brd)' }}>
                    <span style={{ fontSize: 18 }}>{fileIcon(u.type)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.filnavn}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}>{u.uploaded_at ? new Date(u.uploaded_at).toLocaleDateString('da-DK') : ''}</div>
                    </div>
                    <button className="btn btn-outline btn-sm" onClick={() => openFile(u.dropbox_path)}>Åbn</button>
                    <button className="btn btn-red btn-sm" onClick={() => deleteUpload(u)}>✕</button>
                  </div>
                ))}
              </>
            ) : !uploading && <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '8px 0' }}>Ingen filer uploadet endnu</div>}
          </div>

          {sag.bbr_data && (sag.bbr_data.boligareal || sag.bbr_data.grundareal || sag.bbr_data.etager) && (
            <div className="card">
              <div className="section-hd">Ejendomsdata (BBR)</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {[
                  { icon: '📐', val: sag.bbr_data.boligareal ? `${sag.bbr_data.boligareal} m²` : '—', lbl: 'Boligareal' },
                  { icon: '🌿', val: sag.bbr_data.grundareal ? `${sag.bbr_data.grundareal} m²` : '—', lbl: 'Grundareal' },
                  { icon: '🏠', val: sag.bbr_data.etager ? `${sag.bbr_data.etager} etager` : '—', lbl: 'Etager' },
                ].map((b, i) => (
                  <div key={i} style={{ textAlign: 'center', background: 'var(--bg)', borderRadius: 8, padding: 10, border: '.5px solid var(--brd)' }}>
                    <div style={{ fontSize: 18 }}>{b.icon}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--pr)', marginTop: 3 }}>{b.val}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{b.lbl}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showBookModal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowBookModal(false)}>
          <div className="modal">
            <div className="modal-title">Book freelancer<button className="modal-close" onClick={() => setShowBookModal(false)}>✕</button></div>
            {freelancere.length === 0
              ? <div className="empty-state"><div className="empty-icon">📷</div>Ingen freelancere</div>
              : freelancere.map(f => (
                <div key={f.id} onClick={() => bookFreelancer(f.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, border: '.5px solid var(--brd)', borderRadius: 10, marginBottom: 8, cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--pr)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--brd)'}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--pr)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{initials(f.navn)}</div>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{f.navn}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{f.email}</div></div>
                  <div style={{ color: 'var(--pr)', fontWeight: 600 }}>Book →</div>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}
