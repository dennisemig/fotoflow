import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handle = async e => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await signIn(email, password)
    if (error) { setError('Forkert email eller adgangskode'); setLoading(false) }
    else navigate('/')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--surf)', borderRadius: 14, border: '.5px solid var(--brd)', padding: 40, width: 360, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--pr)', textAlign: 'center', marginBottom: 4 }}>
          Vania<span style={{ color: '#8fa8bc', fontWeight: 400 }}>Graphics</span>
        </div>
        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', marginBottom: 28 }}>Log ind på dit system</div>
        {error && <div className="warn-box" style={{ marginBottom: 14 }}>{error}</div>}
        <form onSubmit={handle}>
          <div className="form-group"><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="dennis@vaniagraphics.dk" required /></div>
          <div className="form-group"><label>Adgangskode</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required /></div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={loading}>
            {loading ? 'Logger ind...' : 'Log ind'}
          </button>
        </form>
      </div>
    </div>
  )
}
