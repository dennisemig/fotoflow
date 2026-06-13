// src/pages/FloorplanRedraw.jsx  (eller components/FloorplanRedraw.jsx)
// Tilføj ruten i din App.jsx: <Route path="/plantegning" element={<FloorplanRedraw />} />

import { useState, useRef, useCallback } from 'react'

export default function FloorplanRedraw() {
  const [imageBase64, setImageBase64] = useState(null)
  const [mediaType, setMediaType] = useState('image/jpeg')
  const [previewUrl, setPreviewUrl] = useState(null)
  const [address, setAddress] = useState('')
  const [status, setStatus] = useState(null) // { type: 'loading' | 'success' | 'error', message: string }
  const [svgResult, setSvgResult] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return
    setMediaType(file.type || 'image/jpeg')
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target.result
      setPreviewUrl(dataUrl)
      setImageBase64(dataUrl.split(',')[1])
      setSvgResult(null)
      setStatus(null)
    }
    reader.readAsDataURL(file)
  }, [])

  const onFileChange = (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0])
  }

  const onDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const generate = async () => {
    if (!imageBase64) return
    setStatus({ type: 'loading', message: 'Analyserer skitse med AI…' })
    setSvgResult(null)

    try {
      const res = await fetch('/api/redraw-floorplan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mediaType, address })
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setStatus({ type: 'error', message: data.error || 'Ukendt fejl fra server' })
        return
      }

      setSvgResult(data.svg)
      setStatus({ type: 'success', message: 'Plantegning genereret' })
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Netværksfejl' })
    }
  }

  const downloadSVG = () => {
    if (!svgResult) return
    const blob = new Blob([svgResult], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `plantegning${address ? '-' + address.replace(/\s+/g, '-').toLowerCase() : ''}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadPNG = async () => {
    if (!svgResult) return
    const canvas = document.createElement('canvas')
    const img = new Image()
    const blob = new Blob([svgResult], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    img.onload = () => {
      canvas.width = img.width || 1100
      canvas.height = img.height || 700
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      canvas.toBlob((pngBlob) => {
        const pngUrl = URL.createObjectURL(pngBlob)
        const a = document.createElement('a')
        a.href = pngUrl
        a.download = `plantegning${address ? '-' + address.replace(/\s+/g, '-').toLowerCase() : ''}.png`
        a.click()
        URL.revokeObjectURL(pngUrl)
        URL.revokeObjectURL(url)
      }, 'image/png')
    }
    img.src = url
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        {/* Header */}
        <div style={styles.header}>
          <span style={styles.logo}>vania.</span>
          <span style={styles.logoSub}>PLANTEGNING AI</span>
        </div>
        <p style={styles.subtitle}>Upload en håndtegnet skitse og få den rentegnet automatisk</p>

        {/* Upload zone */}
        <div
          style={{ ...styles.dropZone, ...(isDragging ? styles.dropZoneActive : {}) }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Skitse forhåndsvisning" style={styles.preview} />
          ) : (
            <div style={styles.uploadPlaceholder}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <p style={styles.uploadText}>Klik eller træk skitse hertil</p>
              <p style={styles.uploadHint}>JPG eller PNG</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={onFileChange}
          />
        </div>

        {/* Address input */}
        <div style={styles.field}>
          <label style={styles.label}>Adresse (vises på plantegningen)</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="fx Hold-An vej 12, 2750 Ballerup"
            style={styles.input}
          />
        </div>

        {/* Generate button */}
        <button
          onClick={generate}
          disabled={!imageBase64 || status?.type === 'loading'}
          style={{
            ...styles.btn,
            ...(!imageBase64 || status?.type === 'loading' ? styles.btnDisabled : {})
          }}
        >
          {status?.type === 'loading' ? 'Genererer…' : 'Rentegn plantegning →'}
        </button>

        {/* Status */}
        {status && status.type !== 'loading' && (
          <p style={{ ...styles.statusMsg, color: status.type === 'error' ? '#c0392b' : '#27ae60' }}>
            {status.message}
          </p>
        )}
        {status?.type === 'loading' && (
          <p style={{ ...styles.statusMsg, color: '#888' }}>{status.message}</p>
        )}

        {/* SVG Result */}
        {svgResult && (
          <div style={styles.resultWrap}>
            <div
              style={styles.svgContainer}
              dangerouslySetInnerHTML={{ __html: svgResult }}
            />
            <div style={styles.downloadRow}>
              <button onClick={downloadSVG} style={styles.btnSecondary}>
                Download SVG
              </button>
              <button onClick={downloadPNG} style={styles.btnSecondary}>
                Download PNG
              </button>
              <button
                onClick={() => { setImageBase64(null); setPreviewUrl(null); setSvgResult(null); setStatus(null) }}
                style={{ ...styles.btnSecondary, color: '#999' }}
              >
                Ny skitse
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f7f5f2',
    padding: '2rem 1rem',
    fontFamily: "'Jost', sans-serif",
  },
  container: {
    maxWidth: 820,
    margin: '0 auto',
    background: '#ffffff',
    borderRadius: 12,
    padding: '2.5rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
  },
  header: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 6,
  },
  logo: {
    fontFamily: 'Georgia, serif',
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  logoSub: {
    fontSize: 9,
    letterSpacing: '0.15em',
    color: '#aaa',
    fontWeight: 500,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: '1.75rem',
    marginTop: 0,
  },
  dropZone: {
    border: '1.5px dashed #d0ccc6',
    borderRadius: 10,
    padding: '2rem',
    textAlign: 'center',
    cursor: 'pointer',
    background: '#faf9f7',
    transition: 'background 0.15s, border-color 0.15s',
    marginBottom: '1.25rem',
    minHeight: 140,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropZoneActive: {
    background: '#f0ede8',
    borderColor: '#bbb',
  },
  uploadPlaceholder: {
    pointerEvents: 'none',
  },
  uploadText: {
    fontSize: 15,
    fontWeight: 500,
    color: '#555',
    margin: '10px 0 4px',
  },
  uploadHint: {
    fontSize: 12,
    color: '#aaa',
    margin: 0,
  },
  preview: {
    maxWidth: '100%',
    maxHeight: 320,
    borderRadius: 6,
    objectFit: 'contain',
  },
  field: {
    marginBottom: '1.25rem',
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 500,
    color: '#888',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 14px',
    fontSize: 14,
    border: '0.5px solid #ddd',
    borderRadius: 8,
    background: '#faf9f7',
    color: '#1a1a1a',
    outline: 'none',
  },
  btn: {
    width: '100%',
    padding: '13px',
    background: '#1a1a1a',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    letterSpacing: '0.03em',
  },
  btnDisabled: {
    background: '#ccc',
    cursor: 'not-allowed',
  },
  statusMsg: {
    fontSize: 13,
    marginTop: 10,
    marginBottom: 0,
  },
  resultWrap: {
    marginTop: '2rem',
    borderTop: '0.5px solid #eee',
    paddingTop: '1.5rem',
  },
  svgContainer: {
    width: '100%',
    overflowX: 'auto',
    background: '#fff',
    border: '0.5px solid #e8e5e0',
    borderRadius: 8,
    padding: '1rem',
  },
  downloadRow: {
    display: 'flex',
    gap: 10,
    marginTop: '1rem',
    flexWrap: 'wrap',
  },
  btnSecondary: {
    padding: '8px 18px',
    fontSize: 13,
    border: '0.5px solid #ddd',
    borderRadius: 8,
    background: 'transparent',
    cursor: 'pointer',
    color: '#444',
  },
}
