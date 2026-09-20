import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Levering() {
  const { token } = useParams()
  const [sag, setSag] = useState(null)
  const [billeder, setBilleder] = useState([])
  const [thumbnails, setThumbnails] = useState({})
  const [loading, setLoading] = useState(true)
  const [udloebet, setUdloebet] = useState(false)
  const [valgte, setValgte] = useState(new Set())
  const [downloading, setDownloading] = useState(false)
  const [lightbox, setLightbox] = useState(null)

  useEffect(() => { fetchLevering() }, [token])

  useEffect(() => {
    function onKey(e) {
      if (!lightbox) return
      const idx = billeder.findIndex(b => b.id === lightbox.id)
      if (e.key === 'ArrowRight' && idx < billeder.length - 1) setLightbox(billeder[idx + 1])
      if (e.key === 'ArrowLeft' && idx > 0) setLightbox(billeder[idx - 1])
      if (e.key === 'Escape') setLightbox(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, billeder])

  async function fetchLevering() {
    setLoading(true)
    const { data: sagData } = await supabase
      .from('sager')
      .select('*')
      .eq('levering_token', token)
      .single()

    if (!sagData) { setLoading(false); setUdloebet(true); return }

    if (sagData.levering_udloeber && new Date(sagData.levering_udloeber) < new Date()) {
      setLoading(false); setUdloebet(true); return
    }

    setSag(sagData)

    const { data: uploads } = await supabase
      .from('uploads')
      .select('*')
      .eq('sag_id', sagData.id)
      .order('bruger_tag', { ascending: true })

    const billedMedLinks = []
    for (const u of (uploads || [])) {
      try {
        const { data } = await supabase.storage.from('sager').createSignedUrl(u.dropbox_path, 7 * 24 * 60 * 60)
        if (data?.signedUrl) billedMedLinks.push({ ...u, url: data.signedUrl })
      } catch {}
    }

    setBilleder(billedMedLinks)
    const thumbMap = {}
    billedMedLinks.forEach(b => { thumbMap[b.id] = b.url })
    setThumbnails(thumbMap)
    setLoading(false)
  }

  function toggleValgt(id) {
    setValgte(v => { const ny = new Set(v); ny.has(id) ? ny.delete(id) : ny.add(id); return ny })
  }

  function vælgAlle() {
    setValgte(valgte.size === billeder.length ? new Set() : new Set(billeder.map(b => b.id)))
  }

  async function downloadFil(billede) {
    const r = await fetch(billede.url)
    const blob = await r.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = billede.filnavn
    a.click()
  }

  async function downloadValgte() {
    setDownloading(true)
    const valgteBilleder = billeder.filter(b => valgte.has(b.id))
    for (const b of valgteBilleder) {
      await downloadFil(b)
      await new Promise(r => setTimeout(r, 500))
    }
    setDownloading(false)
  }

  async function downloadAlle() {
    setDownloading(true)
    for (const b of billeder) {
      await downloadFil(b)
      await new Promise(r => setTimeout(r, 500))
    }
    setDownloading(false)
  }

  const grouped = {}
  billeder.forEach(b => {
    const tag = b.bruger_tag || 'Andet'
    if (!grouped[tag]) grouped[tag] = []
    grouped[tag].push(b)
  })

  const dagetilbage = sag?.levering_udloeber
    ? Math.ceil((new Date(sag.levering_udloeber) - new Date()) / (1000 * 60 * 60 * 24))
    : 7

  const mono = "'DM Mono', 'SF Mono', 'Fira Mono', monospace"
  const serif = "'EB Garamond', Georgia, serif"

  const cbStyle = (erValgt) => ({
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    border: '1.5px solid rgba(255,255,255,0.8)',
    background: erValgt ? '#1a1a1a' : 'rgba(10,10,10,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 2,
    fontSize: 11,
    color: '#f0ede8',
    fontFamily: mono,
  })

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f0ede8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono }}>
      <div style={{ textAlign: 'center', letterSpacing: '.1em', fontSize: 11, color: '#888', textTransform: 'uppercase' }}>
        Henter arkiv...
      </div>
    </div>
  )

  if (udloebet) return (
    <div style={{ minHeight: '100vh', background: '#f0ede8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, padding: 32 }}>
      <div style={{ maxWidth: 400, textAlign: 'center' }}>
        <img src="/vania-logo.png" alt="Vania" style={{ height: 24, marginBottom: 28, opacity: 0.6 }} />
        <div style={{ fontSize: 22, fontFamily: serif, color: '#1a1a1a', marginBottom: 12 }}>Linket er udløbet</div>
        <div style={{ fontSize: 12, color: '#666', lineHeight: 1.8, marginBottom: 28 }}>
          Dette leveringslink er ikke længere aktivt.<br />
          Kontakt Vania for et nyt link.
        </div>
        <a href="mailto:dennis@vania.dk" style={{ fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', color: '#1a1a1a', textDecoration: 'none', borderBottom: '1px solid #1a1a1a', paddingBottom: 2 }}>
          dennis@vania.dk
        </a>
      </div>
    </div>
  )

  const tagEntries = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))
  const totalBilleder = billeder.length

  return (
    <div style={{ minHeight: '100vh', background: '#f0ede8', fontFamily: mono }}>

      {/* LIGHTBOX */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,.95)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img
            src={lightbox.url}
            alt={lightbox.filnavn}
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }}
            onClick={e => e.stopPropagation()}
          />
          <div style={{ position: 'absolute', top: 20, right: 24, color: '#fff', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', cursor: 'pointer', opacity: .6 }}
            onClick={() => setLightbox(null)}>
            Luk / ESC
          </div>
          <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', color: '#fff', fontSize: 10, letterSpacing: '.1em', opacity: .5 }}>
            {lightbox.filnavn}
          </div>
          {billeder.findIndex(b => b.id === lightbox.id) > 0 && (
            <div onClick={e => { e.stopPropagation(); const idx = billeder.findIndex(b => b.id === lightbox.id); setLightbox(billeder[idx - 1]) }}
              style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', color: '#fff', fontSize: 28, cursor: 'pointer', opacity: .5, userSelect: 'none' }}>
              ‹
            </div>
          )}
          {billeder.findIndex(b => b.id === lightbox.id) < billeder.length - 1 && (
            <div onClick={e => { e.stopPropagation(); const idx = billeder.findIndex(b => b.id === lightbox.id); setLightbox(billeder[idx + 1]) }}
              style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', color: '#fff', fontSize: 28, cursor: 'pointer', opacity: .5, userSelect: 'none' }}>
              ›
            </div>
          )}
        </div>
      )}

      {/* HEADER */}
      <div style={{ borderBottom: '1px solid #ccc', padding: '14px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <img src="/vania-logo.png" alt="Vania" style={{ height: 28, display: 'block', marginBottom: 6 }} />
          <div style={{ fontSize: 9, letterSpacing: '.15em', textTransform: 'uppercase', color: '#aaa' }}>
            BILLEDARKIV — LEVERING
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, letterSpacing: '.15em', textTransform: 'uppercase', color: '#aaa', marginBottom: 2 }}>
            TILGÆNGELIGT
          </div>
          <div style={{ fontSize: 9, letterSpacing: '.1em', color: '#888' }}>
            {dagetilbage} DAG{dagetilbage !== 1 ? 'E' : ''} TILBAGE
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px' }}>

        {/* SAG INFO */}
        <div style={{ padding: '28px 0 20px', borderBottom: '1px solid #ddd', display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', color: '#999', marginBottom: 8 }}>ADRESSE</div>
            <div style={{ fontSize: 26, fontFamily: serif, color: '#1a1a1a', fontWeight: 400, lineHeight: 1.2 }}>
              {sag?.adresse}
            </div>
            <div style={{ marginTop: 10, fontSize: 10, letterSpacing: '.1em', color: '#888' }}>
              {sag?.dato ? new Date(sag.dato + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase() : ''}
              {' · '}
              {totalBilleder} FILER · {tagEntries.length} KATEGORIER
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, letterSpacing: '.15em', color: '#999', marginBottom: 4 }}>REF.</div>
            <div style={{ fontSize: 10, color: '#888', letterSpacing: '.05em' }}>
              {token?.slice(0, 8).toUpperCase()}
            </div>
          </div>
        </div>

        {/* TOOLBAR */}
        <div style={{ padding: '14px 0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid #ddd' }}>
          <button onClick={vælgAlle}
            style={{ fontSize: 9, letterSpacing: '.15em', textTransform: 'uppercase', padding: '7px 14px', border: '1px solid #bbb', background: 'transparent', cursor: 'pointer', color: '#444', fontFamily: mono }}>
            {valgte.size === billeder.length ? '— FRAVÆLG ALLE' : '+ VÆLG ALLE'}
          </button>

          {valgte.size > 0 && (
            <button onClick={downloadValgte} disabled={downloading}
              style={{ fontSize: 9, letterSpacing: '.15em', textTransform: 'uppercase', padding: '7px 16px', border: '1px solid #1a1a1a', background: '#1a1a1a', color: '#f0ede8', cursor: 'pointer', fontFamily: mono }}>
              {downloading ? 'DOWNLOADER...' : `↓ DOWNLOAD VALGTE (${valgte.size})`}
            </button>
          )}

          <button onClick={downloadAlle} disabled={downloading}
            style={{ fontSize: 9, letterSpacing: '.15em', textTransform: 'uppercase', padding: '7px 16px', border: '1px solid #1a1a1a', background: 'transparent', color: '#1a1a1a', cursor: 'pointer', fontFamily: mono }}>
            {downloading ? 'DOWNLOADER...' : `↓ DOWNLOAD ALLE (${totalBilleder})`}
          </button>

          {valgte.size > 0 && (
            <div style={{ marginLeft: 'auto', fontSize: 9, letterSpacing: '.1em', color: '#888', textTransform: 'uppercase' }}>
              {valgte.size} VALGT
            </div>
          )}
        </div>

        {/* GROUPED GRID */}
        {tagEntries.map(([tag, items], groupIdx) => (
          <div key={tag} style={{ marginTop: 32, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid #ccc' }}>
              <div style={{ fontSize: 9, letterSpacing: '.25em', textTransform: 'uppercase', color: '#444' }}>{tag}</div>
              <div style={{ fontSize: 9, letterSpacing: '.1em', color: '#aaa' }}>{String(items.length).padStart(2, '0')}</div>
              <div style={{ marginLeft: 'auto', fontSize: 9, letterSpacing: '.1em', color: '#bbb' }}>
                {String(groupIdx + 1).padStart(2, '0')} / {String(tagEntries.length).padStart(2, '0')}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {items.map((b) => {
                const erValgt = valgte.has(b.id)
                const thumb = thumbnails[b.id] || b.url
                const nr = billeder.indexOf(b) + 1

                return (
                  <div key={b.id}>
                    {/* BILLEDE — klik åbner lightbox */}
                    <div
                      onClick={() => setLightbox(b)}
                      style={{ position: 'relative', paddingBottom: '75%', background: '#ddd', overflow: 'hidden', cursor: 'pointer' }}>
                      {thumb && (
                        <img src={thumb} alt={b.filnavn}
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'opacity .2s', opacity: erValgt ? 0.55 : 1 }} />
                      )}
                      {/* CHECKBOX */}
                      <div
                        onClick={e => { e.stopPropagation(); toggleValgt(b.id) }}
                        style={cbStyle(erValgt)}>
                        {erValgt ? '✓' : ''}
                      </div>
                      {/* FOTO NR */}
                      <div style={{ position: 'absolute', bottom: 6, left: 8, fontSize: 9, letterSpacing: '.1em', color: 'rgba(255,255,255,.7)', fontFamily: mono, pointerEvents: 'none' }}>
                        {String(nr).padStart(2, '0')}
                      </div>
                    </div>

                    {/* UNDER BILLEDET */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0 10px' }}>
                      <div style={{ fontSize: 9, letterSpacing: '.05em', color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                        {b.filnavn}
                      </div>
                      <span onClick={() => downloadFil(b)}
                        style={{ fontSize: 9, letterSpacing: '.1em', color: '#888', cursor: 'pointer', textTransform: 'uppercase', textDecoration: 'underline' }}>
                        ↓
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* FOOTER */}
        <div style={{ borderTop: '1px solid #ccc', marginTop: 40, padding: '20px 0 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <img src="/vania-logo.png" alt="Vania" style={{ height: 20, display: 'block', marginBottom: 6, opacity: 0.7 }} />
            <div style={{ fontSize: 9, color: '#bbb', letterSpacing: '.05em' }}>dennis@vania.dk</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, letterSpacing: '.1em', color: '#bbb' }}>
              ARKIV UDLØBER OM {dagetilbage} DAG{dagetilbage !== 1 ? 'E' : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
