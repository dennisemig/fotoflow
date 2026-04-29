import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function Indstillinger() {
  const { profile } = useAuth()
  const [navn, setNavn] = useState(profile?.full_name || 'Dennis')
  const [email] = useState(profile?.email || 'dennis@vaniagraphics.dk')
  const [dropboxKey, setDropboxKey] = useState('')
  const [mindworkingKey, setMindworkingKey] = useState('')
  const [mindworkingUrl, setMindworkingUrl] = useState('')
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    await supabase.from('profiles').update({ full_name: navn }).eq('id', profile?.id)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <div className="page-title">Indstillinger</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 520 }}>

        <div className="card">
          <div className="section-hd">Profil</div>
          <div className="form-group"><label>Navn</label><input value={navn} onChange={e => setNavn(e.target.value)} /></div>
          <div className="form-group"><label>Email</label><input value={email} disabled style={{ opacity: 0.7 }} /></div>
          <div className="form-group"><label>Firmanavn</label><input defaultValue="VaniaGraphics" /></div>
          <button className="btn btn-primary btn-sm" onClick={handleSave}>{saved ? '✓ Gemt!' : 'Gem ændringer'}</button>
        </div>

        <div className="card">
          <div className="section-hd">Dropbox Integration</div>
          <div className="form-group"><label>Dropbox App Key</label><input type="password" value={dropboxKey} onChange={e => setDropboxKey(e.target.value)} placeholder="Opret en Dropbox App på dropbox.com/developers" /></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm">Gem og forbind</button>
            <button className="btn btn-outline btn-sm">Test forbindelse</button>
          </div>
          <div className="info-box" style={{ marginTop: 12 }}>Gå til dropbox.com/developers → Create App → Scoped access → Full Dropbox. Kopier App Key herfra.</div>
        </div>

        <div className="card">
          <div className="section-hd">Mindworking API</div>
          <div className="warn-box" style={{ marginBottom: 14 }}>⏳ Afventer API-dokumentation fra Mindworking – indsæt nøglen her når du modtager den.</div>
          <div className="form-group"><label>API Nøgle</label><input type="password" value={mindworkingKey} onChange={e => setMindworkingKey(e.target.value)} placeholder="Afventer API fra Mindworking..." /></div>
          <div className="form-group"><label>API Endpoint URL</label><input value={mindworkingUrl} onChange={e => setMindworkingUrl(e.target.value)} placeholder="https://api.mindworking.eu/..." /></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" disabled>Gem API</button>
            <button className="btn btn-outline btn-sm" disabled>Test forbindelse</button>
          </div>
        </div>

        <div className="card">
          <div className="section-hd">Email-notifikationer (Resend)</div>
          <div className="ok-box" style={{ marginBottom: 14 }}>✓ Resend er konfigureret – mails sendes fra dennis@vaniagraphics.dk</div>
          {[
            { lbl: 'Send mail ved ny sagsbooking til freelancer', sub: 'Freelanceren får besked straks' },
            { lbl: 'Send påmindelse til freelancer dagen før', sub: 'Automatisk reminder' },
            { lbl: 'Send leveringsmail til kunde automatisk', sub: 'Ved tryk på Send til Mindworking' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 2 ? '0.5px solid var(--brd)' : 'none' }}>
              <div><div style={{ fontWeight: 500, fontSize: 13 }}>{r.lbl}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.sub}</div></div>
              <label className="toggle"><input type="checkbox" defaultChecked /><span className="tslider"></span></label>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="section-hd">Bookingportal</div>
          <div className="form-group"><label>Dit bookinglink</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value="https://vaniagraphics.dk/book/dennis" readOnly style={{ opacity: 0.8 }} />
              <button className="btn btn-outline btn-sm">Kopiér</button>
            </div>
          </div>
          {[
            { lbl: 'Bookingportal aktiv', sub: 'Mæglere kan booke via dit link' },
            { lbl: 'Kræv godkendelse', sub: 'Du godkender hver booking manuelt' },
            { lbl: 'Bekræftelsesmail til mægler', sub: 'Mægler notificeres ved godkendelse' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 2 ? '0.5px solid var(--brd)' : 'none' }}>
              <div><div style={{ fontWeight: 500, fontSize: 13 }}>{r.lbl}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.sub}</div></div>
              <label className="toggle"><input type="checkbox" defaultChecked /><span className="tslider"></span></label>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
