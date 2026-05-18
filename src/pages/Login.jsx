import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nytPassword, setNytPassword] = useState('')
  const [bekraeftPassword, setBekraeftPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('login') // 'login' eller 'set-password'
  const { signIn } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    // Tjek både hash og query params for invitation/recovery token
    const hash = window.location.hash
    const params = new URLSearchParams(window.location.search)
    const type = params.get('type') || ''
    
    if (hash.includes('type=invite') || hash.includes('type=recovery') || 
        type === 'invite' || type === 'recovery' ||
        hash.includes('access_token')) {
      setMode('set-password')
    }
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await signIn(email, password)
    if (error) { setError('Forkert email eller adgangskode'); setLoading(false) }
    else navigate('/')
  }

  async function handleSetPassword(e) {
    e.preventDefault()
    if (nytPassword.length < 6) { setError('Password skal være mindst 6 tegn'); return }
    if (nytPassword !== bekraeftPassword) { setError('Passwords matcher ikke'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.updateUser({ password: nytPassword })
    if (error) { setError('Fejl: ' + error.message); setLoading(false) }
    else navigate('/')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--surf)', borderRadius: 14, border: '.5px solid var(--brd)', padding: 40, width: 360, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--pr)', textAlign: 'center', marginBottom: 4 }}>
          Vania<span style={{ color: '#8fa8bc', fontWeight: 400 }}>Graphics</span>
        </div>
        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', marginBottom: 28 }}>
          {mode === 'set-password' ? 'Opret din adgangskode' : 'Log ind på dit system'}
        </div>

        {error && <div className="warn-box" style={{ marginBottom: 14 }}>{error}</div>}

        {mode === 'set-password' ? (
          <form onSubmit={handleSetPassword}>
            <div className="form-group">
              <label>Vælg adgangskode</label>
              <input type="password" value={nytPassword} onChange={e => setNytPassword(e.target.value)} placeholder="Mindst 6 tegn" required autoFocus />
            </div>
            <div className="form-group">
              <label>Bekræft adgangskode</label>
              <input type="password" value={bekraeftPassword} onChange={e => setBekraeftPassword(e.target.value)} placeholder="Gentag adgangskode" required />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={loading}>
              {loading ? 'Opretter...' : 'Opret adgangskode og log ind'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="dennis@vaniagraphics.dk" required autoFocus />
            </div>
            <div className="form-group">
              <label>Adgangskode</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={loading}>
              {loading ? 'Logger ind...' : 'Log ind'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
