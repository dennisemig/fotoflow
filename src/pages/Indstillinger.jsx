import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useToast, ToastContainer } from '../hooks/useToast'

const DAGE = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']
const TIDER = ['06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00']

const DEFAULT_ARBEJDSTIDER = {
  1: { aktiv: true, fra: '08:00', til: '16:00' },
  2: { aktiv: true, fra: '08:00', til: '16:00' },
  3: { aktiv: true, fra: '08:00', til: '16:00' },
  4: { aktiv: true, fra: '08:00', til: '16:00' },
  5: { aktiv: true, fra: '08:00', til: '14:00' },
  6: { aktiv: false, fra: '09:00', til: '13:00' },
  0: { aktiv: false, fra: '09:00', til: '13:00' },
}

export default function Indstillinger() {
  const { profile, refreshProfile } = useAuth()
  const [form, setForm] = useState({ full_name: '', telefon: '', startadresse: '' })
  const [arbejdstider, setArbejdstider] = useState(DEFAULT_ARBEJDSTIDER)
  const [saving, setSaving] = useState(false)
  const [savingTider, setSavingTider] = useState(false)
  const [nytPassword, setNytPassword] = useState('')
  const [bekraeftPassword, setBekraeftPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const { toasts, toast } = useToast()

  const [profileIndlæst, setProfileIndlæst] = useState(false)

  useEffect(() => {
    if (profile && !profileIndlæst) {
      setForm({ full_name: profile.full_name || '', telefon: profile.telefon || '', startadresse: profile.startadresse || '' })
      setProfileIndlæst(true)
    }
    fetchArbejdstider()
  }, [profile])

  async function fetchArbejdstider() {
    const { data } = await supabase.from('indstillinger').select('vaerdi').eq('noegle', 'arbejdstider').single()
    if (data?.vaerdi) setArbejdstider(data.vaerdi)
  }

  async function saveProfil() {
    setSaving(true)
    await supabase.from('profiles').update({
      full_name: form.full_name, telefon: form.telefon, startadresse: form.startadresse
    }).eq('id', profile?.id)
    await refreshProfile()
    setSaving(false)
    toast('✓ Profil gemt')
  }

  async function saveArbejdstider() {
    setSavingTider(true)
    await supabase.from('indstillinger').upsert({ noegle: 'arbejdstider', vaerdi: arbejdstider }, { onConflict: 'noegle' })
    setSavingTider(false)
    toast('✓ Arbejdstider gemt')
  }

  async function skiftPassword() {
    if (nytPassword.length < 6) { toast('Password skal være mindst 6 tegn', 'error'); return }
    if (nytPassword !== bekraeftPassword) { toast('Passwords matcher ikke', 'error'); return }
    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: nytPassword })
    if (error) toast('Fejl: ' + error.message, 'error')
    else { toast('✓ Adgangskode opdateret!'); setNytPassword(''); setBekraeftPassword('') }
    setSavingPassword(false)
  }

  function setDag(dagIdx, felt, vaerdi) {
    setArbejdstider(prev => ({ ...prev, [dagIdx]: { ...prev[dagIdx], [felt]: vaerdi } }))
  }

  function getSlots(fra, til) {
    const slots = []
    let current = fra
    while (current < til) {
      slots.push(current)
      const [h] = current.split(':').map(Number)
      current = `${String(h + 1).padStart(2, '0')}:00`
    }
    return slots
  }

  const bookingLink = `${import.meta.env.VITE_APP_URL || 'https://app.vaniagraphics.dk'}/book/vaniagraphics`

  return (
    <div>
      <ToastContainer toasts={toasts} />
      <div className="page-title">Indstillinger</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 600 }}>

        {/* PROFIL */}
        <div className="card">
          <div className="section-hd">Profil</div>
          <div className="form-group"><label>Navn</label><input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
          <div className="form-group"><label>Email</label><input value={profile?.email || ''} disabled style={{ opacity: .7 }} /></div>
          <div className="form-group"><label>Telefon</label><input value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} placeholder="+45 xx xx xx xx" /></div>
          <div className="form-group"><label>Startadresse (bruges til km-beregning)</label><input value={form.startadresse} onChange={e => setForm(f => ({ ...f, startadresse: e.target.value }))} placeholder="Din hjemmeadresse..." /></div>
          <button className="btn btn-primary btn-sm" onClick={saveProfil} disabled={saving}>{saving ? 'Gemmer...' : 'Gem profil'}</button>
        </div>

        {/* SKIFT ADGANGSKODE */}
        <div className="card">
          <div className="section-hd">Skift adgangskode</div>
          <div className="form-group">
            <label>Nyt password</label>
            <input type="password" value={nytPassword} onChange={e => setNytPassword(e.target.value)} placeholder="Mindst 6 tegn" />
          </div>
          <div className="form-group">
            <label>Bekræft nyt password</label>
            <input type="password" value={bekraeftPassword} onChange={e => setBekraeftPassword(e.target.value)} placeholder="Gentag password" />
          </div>
          <button className="btn btn-primary btn-sm" onClick={skiftPassword} disabled={savingPassword || !nytPassword || !bekraeftPassword}>
            {savingPassword ? 'Gemmer...' : 'Skift adgangskode'}
          </button>
        </div>

        {/* ARBEJDSTIDER */}
        <div className="card">
          <div className="section-hd">Arbejdstider & tilgængelighed</div>
          <div className="info-box" style={{ marginBottom: 14 }}>
            Disse tider vises som ledige tidsslots på din bookingside. Mæglere kan kun booke inden for disse tider.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 60px 1fr 20px 1fr', gap: 8, padding: '6px 0', borderBottom: '1.5px solid var(--brd)', marginBottom: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>Dag</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>Åben</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>Fra</div>
              <div></div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>Til</div>
            </div>
            {[1,2,3,4,5,6,0].map((dagIdx, i) => {
              const dag = arbejdstider[dagIdx] || { aktiv: false, fra: '08:00', til: '16:00' }
              return (
                <div key={dagIdx} style={{ display: 'grid', gridTemplateColumns: '100px 60px 1fr 20px 1fr', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: '.5px solid var(--brd)', opacity: dag.aktiv ? 1 : 0.5 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{DAGE[i]}</div>
                  <div>
                    <label className="toggle">
                      <input type="checkbox" checked={dag.aktiv} onChange={e => setDag(dagIdx, 'aktiv', e.target.checked)} />
                      <span className="tslider"></span>
                    </label>
                  </div>
                  <select value={dag.fra} onChange={e => setDag(dagIdx, 'fra', e.target.value)} disabled={!dag.aktiv}
                    style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid var(--brd)', fontSize: 13, fontFamily: 'inherit', background: dag.aktiv ? '#fff' : '#f9f9f9' }}>
                    {TIDER.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>–</div>
                  <select value={dag.til} onChange={e => setDag(dagIdx, 'til', e.target.value)} disabled={!dag.aktiv}
                    style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid var(--brd)', fontSize: 13, fontFamily: 'inherit', background: dag.aktiv ? '#fff' : '#f9f9f9' }}>
                    {TIDER.filter(t => t > dag.fra).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: 16, padding: 14, background: 'var(--bg)', borderRadius: 10, border: '.5px solid var(--brd)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>FORHÅNDSVISNING AF TIDSSLOTS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[1,2,3,4,5,6,0].map((dagIdx, i) => {
                const dag = arbejdstider[dagIdx]
                if (!dag?.aktiv) return (
                  <div key={dagIdx} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                    <div style={{ width: 80, color: 'var(--muted)' }}>{DAGE[i]}</div>
                    <div style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Lukket</div>
                  </div>
                )
                const slots = getSlots(dag.fra, dag.til)
                return (
                  <div key={dagIdx} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                    <div style={{ width: 80, fontWeight: 500 }}>{DAGE[i]}</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {slots.map(s => <div key={s} style={{ padding: '2px 8px', borderRadius: 20, background: 'var(--pr)', color: '#fff', fontSize: 11, fontWeight: 600 }}>{s}</div>)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} onClick={saveArbejdstider} disabled={savingTider}>
            {savingTider ? 'Gemmer...' : 'Gem arbejdstider'}
          </button>
        </div>

        {/* BOOKING LINK */}
        <div className="card">
          <div className="section-hd">Bookingportal</div>
          <div className="ok-box" style={{ marginBottom: 14 }}>✓ Din bookingportal er aktiv</div>
          <div className="form-group">
            <label>Dit bookinglink</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={bookingLink} readOnly style={{ opacity: .8 }} />
              <button className="btn btn-outline btn-sm" onClick={() => { navigator.clipboard.writeText(bookingLink); toast('✓ Link kopieret!') }}>Kopiér</button>
            </div>
          </div>
        </div>

        {/* EMAIL */}
        <div className="card">
          <div className="section-hd">Email (Resend)</div>
          <div className="ok-box" style={{ marginBottom: 12 }}>✓ Resend er konfigureret – mails sendes fra dennis@vaniagraphics.dk</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>Daglig mail med næste dags opgaver sendes automatisk kl. 19:00.</div>
          <button className="btn btn-outline btn-sm" onClick={async () => {
            const r = await fetch('/api/daglig-mail', { method: 'GET', headers: { Authorization: 'Bearer VaniaGraphics2026!' } })
            const d = await r.json()
            if (d.success) toast(d.message || `✓ Testmail sendt – ${d.sager} opgave(r) i morgen!`)
            else toast('Fejl: ' + d.error, 'error')
          }}>📧 Send testmail nu</button>
        </div>

        {/* MINDWORKING */}
        <div className="card">
          <div className="section-hd">Mindworking API</div>
          <div className="warn-box" style={{ marginBottom: 14 }}>⏳ Afventer API-dokumentation fra Mindworking</div>
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
