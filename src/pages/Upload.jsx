import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Upload() {
  const [sager, setSager] = useState([])
  const [valgtSag, setValgtSag] = useState('')
  const [filer, setFiler] = useState([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    supabase.from('sager').select('id, adresse, dato').order('dato', { ascending: false }).limit(20)
      .then(({ data }) => setSager(data || []))
  }, [])

  function handleDrop(e) {
    e.preventDefault()
    const dropped = Array.from(e.dataTransfer?.files || e.target.files || [])
    setFiler(prev => [...prev, ...dropped])
  }

  async function handleUpload() {
    if (!valgtSag || filer.length === 0) return
    setUploading(true)
    for (const fil of filer) {
      const path = `sager/${valgtSag}/raw/${fil.name}`
      await supabase.storage.from('raafiler').upload(path, fil, { upsert: true })
    }
    setUploading(false)
    setFiler([])
    alert(`✓ ${filer.length} filer uploadet!`)
  }

  return (
    <div>
      <div className="page-title">Upload billeder</div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="form-group">
          <label>Tilknyt til sag</label>
          <select value={valgtSag} onChange={e => setValgtSag(e.target.value)}>
            <option value="">Vælg sag...</option>
            {sager.map(s => <option key={s.id} value={s.id}>{s.adresse} – {s.dato ? new Date(s.dato).toLocaleDateString('da-DK') : ''}</option>)}
          </select>
        </div>
        <div
          onDrop={handleDrop} onDragOver={e => e.preventDefault()}
          onClick={() => document.getElementById('file-input').click()}
          style={{ border: '2px dashed #c5d3dc', borderRadius: 14, padding: 48, textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
          <div style={{ fontSize: 15, color: 'var(--muted)' }}><strong style={{ color: 'var(--pr)' }}>Træk og slip filer her</strong><br /><span style={{ fontSize: 12 }}>JPG, PNG, RAW, TIFF · Maks 500 MB pr. fil</span></div>
          <input id="file-input" type="file" multiple accept="image/*,.cr3,.cr2,.nef,.arw,.raf" style={{ display: 'none' }} onChange={handleDrop} />
        </div>
        {filer.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{filer.length} filer klar til upload:</div>
            {filer.slice(0, 5).map((f, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--muted)', padding: '4px 0' }}>📷 {f.name} ({(f.size / 1024 / 1024).toFixed(1)} MB)</div>
            ))}
            {filer.length > 5 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>...og {filer.length - 5} fler</div>}
            <button className="btn btn-green" style={{ marginTop: 12 }} onClick={handleUpload} disabled={uploading || !valgtSag}>
              {uploading ? 'Uploader...' : `⬆ Upload ${filer.length} filer til Dropbox`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
