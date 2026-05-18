import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function SetPassword() {
  const [password, setPassword] = useState('')
  const [bekraeft, setBekraeft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function handleSave(e) {
    e.preventDefault()
    if (password.length < 6) { setError('Password skal være mindst 6 tegn'); return }
    if (password !== bekraeft) { setError('Passwords matcher ikke'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError('Fejl: ' + error.message); setLoading(false) }
    else navigate('/')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--surf)', borderRadius: 14, border: '.5px solid var(--brd)', padding: 40, width: 360, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--pr)', textAlign: 'center', marginBottom: 4 }}>
          Vania<span style={{ color: '#8fa8bc', fontWeight: 400 }}>Graphics</span>
        </div>
        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', marginBottom: 28 }}>Opret din adgangskode</div>
        {error && <div className="warn-box" style={{ marginBottom: 14 }}>{error}</div>}
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label>Vælg adgangskode</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mindst 6 tegn" required autoFocus />
          </div>
          <div className="form-group">
            <label>Bekræft adgangskode</label>
            <input type="password" value={bekraeft} onChange={e => setBekraeft(e.target.value)} placeholder="Gentag adgangskode" required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={loading}>
            {loading ? 'Gemmer...' : 'Opret adgangskode →'}
          </button>
        </form>
      </div>
    </div>
  )
}
