// src/pages/FloorplanRedraw.jsx

import { useState, useRef, useCallback } from 'react'

export default function FloorplanRedraw() {
  const [imageBase64, setImageBase64] = useState(null)
  const [mediaType, setMediaType] = useState('image/jpeg')
  const [previewUrl, setPreviewUrl] = useState(null)
  const [address, setAddress] = useState('')
  const [step, setStep] = useState(null) // null | 'analysing' | 'drawing' | 'done' | 'error'
  const [errorMsg, setErrorMsg] = useState('')
  const [svgResult, setSvgResult] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return
    setMediaType(file.type || 'image/jpeg')
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewUrl(e.target.result)
      setImageBase64(e.target.result.split(',')[1])
      setSvgResult(null)
      setStep(null)
      setErrorMsg('')
    }
    reader.readAsDataURL(file)
  }, [])

  const onFileChange = (e) => { if (e.target.files[0]) handleFile(e.target.files[0]) }
  const onDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0])
  }

  const generate = async () => {
    if (!imageBase64) return
    setSvgResult(null)
    setErrorMsg('')
    setStep('analysing')

    try {
      const res = await fetch('/api/redraw-floorplan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mediaType, address })
      })

      // Simulate step transition — server handles both steps internally
      // We show 'drawing' after a delay to indicate progress
      const timer = setTimeout(() => setStep('drawing'), 8000)

      const data = await res.json()
      clearTimeout(timer)

      if (!res.ok || data.error) {
        setStep('error')
        setErrorMsg(data.error || 'Ukendt fejl')
        return
      }

      setSvgResult(data.svg)
      setStep('done')
    } catch (err) {
      setStep('error')
      setErrorMsg(err.message || 'Netværksfejl')
    }
  }

  const downloadSVG = () => {
    if (!svgResult) return
    const blob = new Blob([svgResult], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `plantegning${address ? '-' + address.replace(/[\s,]+/g, '-').toLowerCase() : ''}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadPNG = () => {
    if (!svgResult) return
    const canvas = document.createElement('canvas')
    const img = new Image()
    const blob = new Blob([svgResult], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    img.onload = () => {
      canvas.width = 2400
      canvas.height = Math.round(2400 * (img.height / img.width))
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((pngBlob) => {
        const pngUrl = URL.createObjectURL(pngBlob)
        const a = document.createElement('a')
        a.href = pngUrl
        a.download = `plantegning${address ? '-' + address.replace(/[\s,]+/g, '-').toLowerCase() : ''}.png`
        a.click()
        URL.revokeObjectURL(pngUrl)
        URL.revokeObjectURL(url)
      }, 'image/png')
    }
    img.src = url
  }

  const reset = () => {
    setImageBase64(null)
    setPreviewUrl(null)
    setSvgResult(null)
    setStep(null)
    setErrorMsg('')
    setAddress('')
  }

  const isLoading = step === 'analysing' || step === 'drawing'

  return (
    <div style={s.page}>
      <div style={s.container}>

        {/* Header */}
        <div style={s.header}>
          <div>
            <div style={s.logoRow}>
              <span style={s.logo}>vania.</span>
              <span style={s.logoSub}>PLANTEGNING AI</span>
            </div>
            <p style={s.subtitle}>Upload en håndtegnet skitse — AI rentegner den automatisk</p>
          </div>
          {svgResult && (
            <button onClick={reset} style={s.btnGhost}>Ny skitse</button>
          )}
        </div>

        {/* Upload + form (skjult når resultat vises) */}
        {!svgResult && (
          <>
            <div
              style={{ ...s.dropZone, ...(isDragging ? s.dropZoneActive : {}) }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Skitse" style={s.preview} />
              ) : (
                <div style={s.placeholder}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <path d="M3 9h18M9 21V9"/>
                  </svg>
                  <p style={s.uploadText}>Klik eller træk skitse hertil</p>
                  <p style={s.uploadHint}>JPG eller PNG</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
            </div>

            <div style={s.field}>
              <label style={s.label}>Adresse</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="fx Kærlodden 28, 2760 Måløv"
                style={s.input}
                disabled={isLoading}
              />
            </div>

            <button
              onClick={generate}
              disabled={!imageBase64 || isLoading}
              style={{ ...s.btn, ...(!imageBase64 || isLoading ? s.btnDisabled : {}) }}
            >
              {isLoading ? 'Genererer…' : 'Rentegn plantegning'}
            </button>
          </>
        )}

        {/* Status steps */}
        {isLoading && (
          <div style={s.steps}>
            <div style={{ ...s.stepItem, ...(step === 'analysing' ? s.stepActive : s.stepDone) }}>
              <div style={s.stepDot}>{step === 'drawing' || step === 'done' ? '✓' : '●'}</div>
              <div>
                <div style={s.stepTitle}>Trin 1 — Analyserer skitse</div>
                <div style={s.stepDesc}>AI identificerer rum, mål, døre og vinduer</div>
              </div>
            </div>
            <div style={{ ...s.stepItem, ...(step === 'drawing' ? s.stepActive : step === 'done' ? s.stepDone : s.stepPending) }}>
              <div style={s.stepDot}>{step === 'done' ? '✓' : '○'}</div>
              <div>
                <div style={s.stepTitle}>Trin 2 — Tegner SVG</div>
                <div style={s.stepDesc}>Genererer præcis plantegning i Vania-stil</div>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div style={s.errorBox}>
            <strong>Fejl:</strong> {errorMsg}
            <button onClick={() => setStep(null)} style={{ ...s.btnGhost, marginLeft: 12 }}>Prøv igen</button>
          </div>
        )}

        {/* Result */}
        {svgResult && (
          <>
            <div style={s.svgWrap} dangerouslySetInnerHTML={{ __html: svgResult }} />
            <div style={s.downloadRow}>
              <button onClick={downloadSVG} style={s.btnSecondary}>
                Download SVG
              </button>
              <button onClick={downloadPNG} style={s.btnSecondary}>
                Download PNG (2400px)
              </button>
            </div>
            <p style={s.hint}>SVG kan åbnes i Illustrator til finpudsning</p>
          </>
        )}
      </div>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#f7f5f2',
    padding: '2rem 1rem',
    fontFamily: "'Jost', 'Inter', sans-serif",
  },
  container: {
    maxWidth: 860,
    margin: '0 auto',
    background: '#ffffff',
    borderRadius: 12,
    padding: '2.5rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1.75rem',
  },
  logoRow: { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 },
  logo: { fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 'bold', color: '#1a1a1a' },
  logoSub: { fontSize: 9, letterSpacing: '0.15em', color: '#bbb', fontWeight: 500 },
  subtitle: { fontSize: 13, color: '#999', margin: 0 },
  dropZone: {
    border: '1.5px dashed #d8d4ce',
    borderRadius: 10,
    padding: '2rem',
    textAlign: 'center',
    cursor: 'pointer',
    background: '#faf9f7',
    transition: 'background 0.15s',
    marginBottom: '1.25rem',
    minHeight: 140,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropZoneActive: { background: '#f0ede8', borderColor: '#bbb' },
  placeholder: { pointerEvents: 'none' },
  uploadText: { fontSize: 15, fontWeight: 500, color: '#666', margin: '10px 0 4px' },
  uploadHint: { fontSize: 12, color: '#bbb', margin: 0 },
  preview: { maxWidth: '100%', maxHeight: 340, borderRadius: 6, objectFit: 'contain' },
  field: { marginBottom: '1.25rem' },
  label: {
    display: 'block', fontSize: 11, fontWeight: 500, color: '#aaa',
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em',
  },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '10px 14px',
    fontSize: 14, border: '0.5px solid #ddd', borderRadius: 8,
    background: '#faf9f7', color: '#1a1a1a', outline: 'none',
  },
  btn: {
    width: '100%', padding: '13px', background: '#1a1a1a', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500,
    cursor: 'pointer', letterSpacing: '0.03em',
  },
  btnDisabled: { background: '#ccc', cursor: 'not-allowed' },
  btnGhost: {
    background: 'transparent', border: '0.5px solid #ddd', borderRadius: 8,
    padding: '7px 16px', fontSize: 13, cursor: 'pointer', color: '#666',
  },
  btnSecondary: {
    padding: '9px 20px', fontSize: 13, border: '0.5px solid #ddd',
    borderRadius: 8, background: 'transparent', cursor: 'pointer', color: '#444',
  },
  steps: { marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: 12 },
  stepItem: { display: 'flex', gap: 14, alignItems: 'flex-start', padding: '12px 16px', borderRadius: 8 },
  stepActive: { background: '#faf9f7', border: '0.5px solid #e0ddd8' },
  stepDone: { background: '#f5faf5', border: '0.5px solid #d0e8d0' },
  stepPending: { background: 'transparent', border: '0.5px solid #eee', opacity: 0.5 },
  stepDot: { fontSize: 16, color: '#1a1a1a', minWidth: 20, marginTop: 1 },
  stepTitle: { fontSize: 13, fontWeight: 500, color: '#1a1a1a', marginBottom: 2 },
  stepDesc: { fontSize: 12, color: '#999' },
  errorBox: {
    marginTop: '1rem', padding: '12px 16px', background: '#fff5f5',
    border: '0.5px solid #f0d0d0', borderRadius: 8, fontSize: 13, color: '#c0392b',
  },
  svgWrap: {
    width: '100%', overflowX: 'auto', background: '#fff',
    border: '0.5px solid #e8e5e0', borderRadius: 8, padding: '1rem', marginTop: '1.5rem',
  },
  downloadRow: { display: 'flex', gap: 10, marginTop: '1rem', flexWrap: 'wrap' },
  hint: { fontSize: 12, color: '#bbb', marginTop: 8 },
}
