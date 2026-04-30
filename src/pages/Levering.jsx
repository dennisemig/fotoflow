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

  useEffect(() => { fetchLevering() }, [token])

  async function fetchLevering() {
    setLoading(true)
    const { data: sagData } = await supabase
      .from('sager')
      .select('*')
      .eq('levering_token', token)
      .single()

    if (!sagData) { setLoading(false); setUdloebet(true); return }

    // Tjek om link er udløbet
    if (sagData.levering_udloeber && new Date(sagData.levering_udloeber) < new Date()) {
      setLoading(false); setUdloebet(true); return
    }

    setSag(sagData)

    // Hent billeder
    const { data: uploads } = await supabase
      .from('uploads')
      .select('*')
      .eq('sag_id', sagData.id)
      .order('bruger_tag', { ascending: true })

    // Generer signerede URLs
    const billedMedLinks = []
    for (const u of (uploads || [])) {
      try {
        const { data } = await supabase.storage.from('sager').createSignedUrl(u.dropbox_path, 7 * 24 * 60 * 60)
        if (data?.signedUrl) billedMedLinks.push({ ...u, url: data.signedUrl })
      } catch {}
    }

    setBilleder(billedMedLinks)

    // Brug direkte URL som thumbnail – virker på alle enheder
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
      await new Promise(r => setTimeout(r, 500)) // lille pause mellem downloads
    }
    setDownloading(false)
  }

  // Gruppér efter tag
  const grouped = {}
  billeder.forEach(b => {
    const tag = b.bruger_tag || 'Andet'
    if (!grouped[tag]) grouped[tag] = []
    grouped[tag].push(b)
  })

  const dagetilbage = sag?.levering_udloeber
    ? Math.ceil((new Date(sag.levering_udloeber) - new Date()) / (1000 * 60 * 60 * 24))
    : 7

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f5f7', fontFamily: 'system-ui' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        <div style={{ color: '#6b7280' }}>Henter billeder...</div>
      </div>
    </div>
  )

  if (udloebet) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f5f7', fontFamily: 'system-ui' }}>
      <div style={{ textAlign: 'center', maxWidth: 380, padding: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏰</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>Linket er udløbet</div>
        <div style={{ color: '#6b7280', lineHeight: 1.6 }}>Dette leveringslink er ikke længere gyldigt. Kontakt VaniaGraphics for at få et nyt link.</div>
        <a href="mailto:dennis@vaniagraphics.dk" style={{ display: 'inline-block', marginTop: 20, background: '#3A4A5A', color: '#fff', padding: '10px 20px', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
          Kontakt VaniaGraphics
        </a>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f4f5f7', fontFamily: 'system-ui' }}>
      {/* HEADER */}
      <div style={{ background: '#3A4A5A', color: '#fff', padding: '16px 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>📷 VaniaGraphics</div>
            <div style={{ fontSize: 13, opacity: .75, marginTop: 2 }}>Billedlevering</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, opacity: .75 }}>⏳ Tilgængeligt i {dagetilbage} dag{dagetilbage !== 1 ? 'e' : ''} endnu</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
        {/* INFO */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, border: '.5px solid #e5e7eb' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', marginBottom: 6 }}>{sag?.adresse}</div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>
            {sag?.dato ? new Date(sag.dato + 'T12:00:00').toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''}
            {' · '}{billeder.length} billeder
          </div>
        </div>

        {/* TOOLBAR */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '12px 16px', marginBottom: 16, border: '.5px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={vælgAlle}
            style={{ padding: '7px 14px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {valgte.size === billeder.length ? '☑ Fravælg alle' : '☐ Vælg alle'}
          </button>

          {valgte.size > 0 && (
            <button onClick={downloadValgte} disabled={downloading}
              style={{ padding: '7px 16px', borderRadius: 8, background: '#3A4A5A', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {downloading ? '⏳ Downloader...' : `⬇ Download ${valgte.size} billede${valgte.size !== 1 ? 'r' : ''}`}
            </button>
          )}

          <button onClick={async () => { setValgte(new Set(billeder.map(b => b.id))); setTimeout(downloadValgte, 100) }}
            disabled={downloading}
            style={{ padding: '7px 16px', borderRadius: 8, background: '#2e7d4f', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            ⬇ Download alle ({billeder.length})
          </button>

          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>
            Klik på billeder for at vælge
          </div>
        </div>

        {/* GROUPED GRID */}
        {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([tag, items]) => (
          <div key={tag} style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>{tag}</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>({items.length})</div>
              <div style={{ flex: 1, height: 1, background: '#e5e7eb' }}></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {items.map(b => {
                const erValgt = valgte.has(b.id)
                const thumb = thumbnails[b.id] || b.url

                return (
                  <div key={b.id}
                    style={{ borderRadius: 10, overflow: 'hidden', border: erValgt ? '3px solid #3A4A5A' : '3px solid transparent', background: '#fff', boxShadow: erValgt ? '0 0 0 2px #3A4A5A' : '0 1px 4px rgba(0,0,0,.08)', transition: 'all .15s', cursor: 'pointer' }}
                    onClick={() => toggleValgt(b.id)}>

                    {/* THUMBNAIL */}
                    <div style={{ position: 'relative', paddingBottom: '75%', background: '#e8edf1' }}>
                      {thumb ? (
                        <img src={thumb} alt={b.filnavn}
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
                          {b.type === 'raw' ? '📷' : '🖼'}
                        </div>
                      )}

                      {erValgt && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(58,74,90,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#3A4A5A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700 }}>✓</div>
                        </div>
                      )}

                      {/* DOWNLOAD KNAP */}
                      <div onClick={e => { e.stopPropagation(); downloadFil(b) }}
                        style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,.6)', color: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                        ⬇ Download
                      </div>
                    </div>

                    {/* FILNAVN */}
                    <div style={{ padding: '8px 10px' }}>
                      <div style={{ fontSize: 11, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.filnavn}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* FOOTER */}
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#9ca3af', fontSize: 12 }}>
          📷 VaniaGraphics · dennis@vaniagraphics.dk · Billederne er tilgængelige i {dagetilbage} dage
        </div>
      </div>
    </div>
  )
}
