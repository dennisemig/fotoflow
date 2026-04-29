import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useToast, ToastContainer } from '../hooks/useToast'

export default function Indstillinger() {
  const { profile } = useAuth()
  const [form, setForm] = useState({ full_name: '', telefon: '', startadresse: '' })
  const [saving, setSaving] = useState(false)
  const { toasts, toast } = useToast()

  useEffect(() => {
    if (profile) setForm({ full_name: profile.full_name || '', telefon: profile.telefon || '', startadresse: profile.startadresse || '' })
  }, [profile])

  async function saveProfil() {
    setSaving(true)
    await supabase.from('profiles').update({ full_name: form.full_name, telefon: form.telefon, startadresse: form.startadresse }).eq('id', profile?.id)
    setSaving(false); toast('✓ Profil gemt')
  }

  const bookingLink = `${import.meta.env.VITE_APP_URL}/book/vaniagraphics`

  return (
    <div>
      <ToastContainer toasts={toasts} />
      <div className="page-title">Indstillinger</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 560 }}>

        <div className="card">
          <div className="section-hd">Profil</div>
          <div className="form-group"><label>Navn</label><input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
          <div className="form-group"><label>Email</label><input value={profile?.email || 'dennis@vaniagraphics.dk'} disabled style={{ opacity: .7 }} /></div>
          <div className="form-group"><label>Telefon</label><input value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} placeholder="+45 xx xx xx xx" /></div>
          <div className="form-group"><label>Startadresse (bruges til km-beregning)</label><input value={form.startadresse} onChange={e => setForm(f => ({ ...f, startadresse: e.target.value }))} placeholder="Din hjemmeadresse..." /></div>
          <button className="btn btn-primary btn-sm" onClick={saveProfil} disabled={saving}>{saving ? 'Gemmer...' : 'Gem profil'}</button>
        </div>

        <div className="card">
          <div className="section-hd">Bookingportal</div>
          <div className="ok-box" style={{ marginBottom: 14 }}>✓ Din bookingportal er aktiv – mæglere kan booke direkte.</div>
          <div className="form-group">
            <label>Dit bookinglink</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={bookingLink} readOnly style={{ opacity: .8 }} />
              <button className="btn btn-outline btn-sm" onClick={() => { navigator.clipboard.writeText(bookingLink); toast('✓ Link kopieret!') }}>Kopiér</button>
            </div>
          </div>
          {[
            { lbl: 'Kræv godkendelse', sub: 'Du godkender manuelt inden sag oprettes' },
            { lbl: 'Bekræftelsesmail til mægler', sub: 'Mægler notificeres ved godkendelse' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '.5px solid var(--brd)' }}>
              <div><div style={{ fontWeight: 500, fontSize: 13 }}>{r.lbl}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.sub}</div></div>
              <label className="toggle"><input type="checkbox" defaultChecked /><span className="tslider"></span></label>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="section-hd">Email (Resend)</div>
          <div className="ok-box" style={{ marginBottom: 14 }}>✓ Resend er konfigureret – mails sendes fra dennis@vaniagraphics.dk</div>
          {[
            { lbl: 'Mail til freelancer ved ny booking', sub: 'Automatisk notifikation' },
            { lbl: 'Påmindelsesmail til freelancer', sub: 'Dagen inden sagen' },
            { lbl: 'Leveringsmail til kunde', sub: 'Automatisk ved Send til Mindworking' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 2 ? '.5px solid var(--brd)' : 'none' }}>
              <div><div style={{ fontWeight: 500, fontSize: 13 }}>{r.lbl}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.sub}</div></div>
              <label className="toggle"><input type="checkbox" defaultChecked /><span className="tslider"></span></label>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="section-hd">Dropbox</div>
          <div className="form-group"><label>Dropbox App Key</label><input type="password" placeholder="Indsæt din Dropbox App Key..." /></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm">Gem og forbind</button>
            <button className="btn btn-outline btn-sm">Test forbindelse</button>
          </div>
          <div className="info-box" style={{ marginTop: 12 }}>Gå til dropbox.com/developers → Create App → Scoped access → Full Dropbox → kopiér App Key herfra.</div>
        </div>

        <div className="card">
          <div className="section-hd">Mindworking API</div>
          <div className="warn-box" style={{ marginBottom: 14 }}>⏳ Afventer API-dokumentation fra Mindworking – tilføj nøglen her når du modtager den.</div>
          <div className="form-group"><label>API Nøgle</label><input type="password" placeholder="Indsæt Mindworking API-nøgle..." /></div>
          <div className="form-group"><label>API Endpoint URL</label><input placeholder="https://api.mindworking.eu/..." /></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" disabled>Gem API</button>
            <button className="btn btn-outline btn-sm" disabled>Test forbindelse</button>
          </div>
        </div>

      </div>
    </div>
  )
}
