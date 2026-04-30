import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function SkiftPassword({ toast }) {
  const [nyt, setNyt] = useState('')
  const [bekraeft, setBekraeft] = useState('')
  const [saving, setSaving] = useState(false)

  async function skiftPassword() {
    if (nyt.length < 6) { toast('Password skal være mindst 6 tegn', 'error'); return }
    if (nyt !== bekraeft) { toast('Passwords matcher ikke', 'error'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: nyt })
    if (error) { toast('Fejl: ' + error.message, 'error') }
    else { toast('✓ Adgangskode opdateret!'); setNyt(''); setBekraeft('') }
    setSaving(false)
  }

  return (
    <div>
      <div className="form-group">
        <label>Nyt password</label>
        <input type="password" value={nyt} onChange={e => setNyt(e.target.value)} placeholder="Mindst 6 tegn" />
      </div>
      <div className="form-group">
        <label>Bekræft nyt password</label>
        <input type="password" value={bekraeft} onChange={e => setBekraeft(e.target.value)} placeholder="Gentag password" />
      </div>
      <button className="btn btn-primary btn-sm" onClick={skiftPassword} disabled={saving || !nyt || !bekraeft}>
        {saving ? 'Gemmer...' : 'Skift adgangskode'}
      </button>
    </div>
  )
}
