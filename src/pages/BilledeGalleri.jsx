import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const TAGS = [
  'Facade', 'Have', 'Terrasse', 'Stue', 'Køkken', 'Alrum',
  'Badeværelse', 'Toilet', 'Soveværelse', 'Værelse', 'Kontor',
  'Kælder', 'Garage', 'Bryggers', 'Gang', 'Trapperum',
  'Plantegning', 'Disponibelt rum', 'Andet'
]

export default function BilledeGalleri({ sagId, sagAdresse, mwNummer, toast }) {
  const [uploads, setUploads] = useState([])
  const [uploading, setUploading] = useState(false)
  const [fileProgress, setFileProgress] = useState({})
  const [valgte, setValgte] = useState(new Set())
  const [thumbnails, setThumbnails] = useState({})
  const [editTag, setEditTag] = useState(null) // id of upload being tagged
  const [sending, setSending] = useState(false)
  const fileInputRef = useRef()

  useEffect(() => { fetchUploads() }, [sagId])

  async function fetchUploads() {
    const { data } = await supabase
      .from('uploads')
      .select('*')
      .eq('sag_id', sagId)
      .order('bruger_tag', { ascending: true, nullsFirst: false })
    setUploads(data || [])
    data?.forEach(u => {
      if (u.type === 'billede' || /\.(jpg|jpeg|png|gif|webp)$/i.test(u.filnavn)) {
        loadThumbnail(u)
      }
    })
  }

  async function loadThumbnail(upload) {
    try {
      const { data } = await supabase.storage.from('sager').createSignedUrl(upload.dropbox_path, 3600, {
        transform: { width: 400, height: 400, resize: 'cover' }
      })
      if (data?.signedUrl) setThumbnails(t => ({ ...t, [upload.id]: data.signedUrl }))
    } catch {
      try {
        const { data } = await supabase.storage.from('sager').createSignedUrl(upload.dropbox_path, 3600)
        if (data?.signedUrl) setThumbnails(t => ({ ...t, [upload.id]: data.signedUrl }))
      } catch {}
    }
  }

  async function uploadFiles(files) {
    if (!files?.length) return
    setUploading(true)
    const sagNavn = sagAdresse?.replace(/[^a-zA-Z0-9æøåÆØÅ]/g, '_').trim() || sagId

    for (const file of Array.from(files)) {
      setFileProgress(p => ({ ...p, [file.name]: 1 }))
      try {
        const cleanName = file.name.replace(/[^a-zA-Z0-9æøåÆØÅ._-]/g, '_')
        const filePath = `${sagId}/${sagNavn}/${Date.now()}_${cleanName}`
        const { error } = await supabase.storage.from('sager').upload(filePath, file, { upsert: true })
        if (error) throw new Error(error.message)
        await supabase.from('uploads').insert([{
          sag_id: sagId, filnavn: file.name, dropbox_path: filePath,
          type: /\.(cr2|cr3|nef|arw|dng|raw|rw2)$/i.test(file.name) ? 'raw' : file.type.startsWith('image/') ? 'billede' : 'fil',
          uploaded_at: new Date().toISOString()
        }])
        setFileProgress(p => ({ ...p, [file.name]: 100 }))
      } catch (e) {
        toast?.(`Fejl: ${file.name}`, 'error')
        setFileProgress(p => ({ ...p, [file.name]: -1 }))
      }
    }
    setUploading(false)
    fetchUploads()
    setTimeout(() => setFileProgress({}), 3000)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function setTag(uploadId, tag) {
    await supabase.from('uploads').update({ bruger_tag: tag }).eq('id', uploadId)
    setUploads(u => u.map(x => x.id === uploadId ? { ...x, bruger_tag: tag } : x))
    setEditTag(null)
    toast?.(`✓ Tag sat: ${tag}`)
  }

  async function openFile(upload) {
    const { data } = await supabase.storage.from('sager').createSignedUrl(upload.dropbox_path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function sletValgte() {
    if (!confirm(`Slet ${valgte.size} fil(er) permanent?`)) return
    const valgteUploads = uploads.filter(u => valgte.has(u.id))
    const paths = valgteUploads.map(u => u.dropbox_path)
    await supabase.storage.from('sager').remove(paths)
    await supabase.from('uploads').delete().in('id', Array.from(valgte))
    setValgte(new Set())
    fetchUploads()
    toast?.('Filer slettet')
  }

  async function uploadTilMindworking() {
    if (!mwNummer) { toast?.('Sæt Mindworking sagsnummer først!', 'error'); return }
    if (valgte.size === 0) { toast?.('Vælg mindst ét billede', 'error'); return }
    setSending(true)

    // Hent signerede URLs for valgte billeder sorteret efter tag
    const valgteBilleder = uploads
      .filter(u => valgte.has(u.id))
      .sort((a, b) => (a.bruger_tag || 'Andet').localeCompare(b.bruger_tag || 'Andet'))

    const links = []
    for (const u of valgteBilleder) {
      const { data } = await supabase.storage.from('sager').createSignedUrl(u.dropbox_path, 86400)
      if (data?.signedUrl) links.push({
        navn: u.filnavn,
        tag: u.bruger_tag || 'Ikke tagget',
        url: data.signedUrl
      })
    }

    // Gruppér efter tag
    const grouped = {}
    links.forEach(l => {
      if (!grouped[l.tag]) grouped[l.tag] = []
      grouped[l.tag].push(l)
    })

    console.log('Mindworking upload klar:', { sagsnummer: mwNummer, billeder: grouped })
    toast?.(`✓ ${links.length} billeder klar – Mindworking API implementeres når dokumentation modtages`)
    setSending(false)
  }

  function toggleValgt(id) {
    setValgte(v => { const ny = new Set(v); ny.has(id) ? ny.delete(id) : ny.add(id); return ny })
  }

  function vælgAlle() {
    setValgte(alleValgt ? new Set() : new Set(uploads.map(u => u.id)))
  }

  // Gruppér uploads efter tag
  const grouped = {}
  uploads.forEach(u => {
    const tag = u.bruger_tag || '— Ikke tagget'
    if (!grouped[tag]) grouped[tag] = []
    grouped[tag].push(u)
  })

  const alleValgt = uploads.length > 0 && valgte.size === uploads.length
  const tagColor = tag => {
    const colors = { 'Facade': '#3b82f6', 'Have': '#22c55e', 'Terrasse': '#84cc16', 'Stue': '#f59e0b', 'Køkken': '#ef4444', 'Badeværelse': '#06b6d4', 'Soveværelse': '#8b5cf6', 'Plantegning': '#6b7280' }
    return colors[tag] || '#3A4A5A'
  }

  return (
    <div>
      {/* UPLOAD ZONE */}
      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--pr)' }}
        onDragLeave={e => e.currentTarget.style.borderColor = '#c5d3dc'}
        onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#c5d3dc'; if (!uploading) uploadFiles(e.dataTransfer.files) }}
        style={{ border: '2px dashed #c5d3dc', borderRadius: 12, padding: 16, textAlign: 'center', cursor: uploading ? 'default' : 'pointer', marginBottom: 12 }}>
        <div style={{ fontSize: 20, marginBottom: 4 }}>{uploading ? '⏳' : '📂'}</div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          {uploading
            ? <strong style={{ color: 'var(--pr)' }}>Uploader...</strong>
            : <><strong style={{ color: 'var(--pr)' }}>Klik eller træk billeder hertil</strong><br /><span style={{ fontSize: 11 }}>JPG, PNG, RAW – ingen størrelsesgrænse</span></>
          }
        </div>
      </div>
      <input ref={fileInputRef} type="file" multiple accept="image/*,.raw,.cr2,.cr3,.nef,.arw,.dng,.rw2" style={{ display: 'none' }} onChange={e => uploadFiles(e.target.files)} />

      {/* UPLOAD PROGRESS */}
      {Object.keys(fileProgress).length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {Object.entries(fileProgress).map(([name, pct]) => (
            <div key={name} style={{ marginBottom: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{name}</span>
                <span style={{ color: pct < 0 ? 'var(--red)' : pct === 100 ? 'var(--grn)' : 'var(--muted)', fontWeight: 600 }}>{pct < 0 ? 'Fejl' : pct === 100 ? '✓' : '⏳'}</span>
              </div>
              <div style={{ height: 3, background: '#e8edf1', borderRadius: 4 }}>
                <div style={{ height: '100%', width: `${Math.max(0, pct)}%`, background: pct < 0 ? 'var(--red)' : 'var(--pr)', borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {uploads.length > 0 && (
        <>
          {/* TOOLBAR */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap', padding: '10px 12px', background: 'var(--bg)', borderRadius: 10, border: '.5px solid var(--brd)' }}>
            <button onClick={vælgAlle} className="btn btn-outline btn-sm" style={{ fontSize: 12 }}>
              {alleValgt ? '☑ Fravælg alle' : '☐ Vælg alle'}
            </button>

            {valgte.size > 0 ? (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--pr)', padding: '3px 10px', background: '#eef4f8', borderRadius: 20 }}>
                  {valgte.size} valgt
                </div>
                <button onClick={uploadTilMindworking} disabled={sending} className="btn btn-sm"
                  style={{ background: '#1a5c43', color: '#fff', fontSize: 12 }}>
                  {sending ? '⏳ Sender...' : `⚡ Upload ${valgte.size} til Mindworking`}
                </button>
                <button onClick={sletValgte} className="btn btn-red btn-sm" style={{ fontSize: 12 }}>
                  🗑 Slet valgte
                </button>
              </>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Klik på billeder for at vælge dem</div>
            )}

            <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>
              {uploads.length} filer · {Object.keys(grouped).length} kategorier
            </div>
          </div>

          {/* GROUPED GRID */}
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([tag, items]) => (
            <div key={tag} style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: tagColor(tag), flexShrink: 0 }}></div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx)' }}>{tag}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>({items.length})</div>
                <div style={{ flex: 1, height: 1, background: 'var(--brd)' }}></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                {items.map(u => {
                  const erValgt = valgte.has(u.id)
                  const thumbnail = thumbnails[u.id]
                  const erBillede = u.type === 'billede' || /\.(jpg|jpeg|png|gif|webp)$/i.test(u.filnavn)

                  return (
                    <div key={u.id} style={{ borderRadius: 10, overflow: 'hidden', border: erValgt ? '3px solid var(--pr)' : '3px solid transparent', background: 'var(--bg)', boxShadow: erValgt ? '0 0 0 1px var(--pr)' : '0 1px 4px rgba(0,0,0,.08)', transition: 'all .15s' }}>

                      {/* BILLEDE */}
                      <div
                        onClick={() => toggleValgt(u.id)}
                        style={{ position: 'relative', width: '100%', paddingBottom: '80%', background: '#dde3e8', cursor: 'pointer' }}>
                        {thumbnail ? (
                          <img src={thumbnail} alt={u.filnavn}
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4 }}>
                            <div style={{ fontSize: 28 }}>{u.type === 'raw' ? '📷' : u.type === 'billede' ? '🖼' : '📄'}</div>
                            <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>{u.filnavn?.split('.').pop()}</div>
                          </div>
                        )}

                        {/* VALGT OVERLAY */}
                        {erValgt && (
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(58,74,90,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--pr)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>✓</div>
                          </div>
                        )}

                        {/* ÅBEN KNAP */}
                        <div onClick={e => { e.stopPropagation(); openFile(u) }}
                          style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,.5)', color: '#fff', borderRadius: 6, padding: '3px 7px', fontSize: 11, cursor: 'pointer' }}>
                          ↗
                        </div>
                      </div>

                      {/* FILNAVN + TAG */}
                      <div style={{ padding: '8px 8px 6px' }}>
                        <div style={{ fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6, color: 'var(--tx)' }} title={u.filnavn}>
                          {u.filnavn}
                        </div>

                        {/* TAG */}
                        {editTag === u.id ? (
                          <div onClick={e => e.stopPropagation()}>
                            <select
                              autoFocus
                              value={u.bruger_tag || ''}
                              onChange={e => setTag(u.id, e.target.value)}
                              onBlur={() => setEditTag(null)}
                              style={{ width: '100%', padding: '4px 6px', borderRadius: 6, border: '1.5px solid var(--pr)', fontSize: 11, fontFamily: 'inherit' }}>
                              <option value="">— Vælg tag —</option>
                              {TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                        ) : (
                          <div
                            onClick={e => { e.stopPropagation(); setEditTag(u.id) }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, background: u.bruger_tag ? tagColor(u.bruger_tag) : '#e8edf1', color: u.bruger_tag ? '#fff' : 'var(--muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer', maxWidth: '100%' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {u.bruger_tag || '+ Tilføj tag'}
                            </span>
                            <span style={{ opacity: .7, fontSize: 10 }}>✎</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}

      {uploads.length === 0 && !uploading && (
        <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--muted)', fontSize: 13 }}>
          Ingen billeder uploadet endnu
        </div>
      )}
    </div>
  )
}
