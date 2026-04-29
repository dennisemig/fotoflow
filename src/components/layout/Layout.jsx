import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useState } from 'react'

const adminNav = [
  { to: '/', icon: '⊞', label: 'Dashboard', exact: true },
  { to: '/sager', icon: '📋', label: 'Sager' },
  { to: '/kunder', icon: '👥', label: 'Kunder (CRM)' },
  { to: '/kalender', icon: '📅', label: 'Kalender' },
  { to: '/upload', icon: '⬆', label: 'Upload' },
  { to: '/freelancere', icon: '📷', label: 'Freelancere' },
  { to: '/koersel', icon: '🚗', label: 'Kørselsrapport' },
  { to: '/pakker', icon: '📦', label: 'Pakker & Tillæg' },
]

const freelancerNav = [
  { to: '/', icon: '⊞', label: 'Mine sager', exact: true },
  { to: '/upload', icon: '⬆', label: 'Upload billeder' },
  { to: '/koersel', icon: '🚗', label: 'Min kørselsrapport' },
]

export default function Layout() {
  const { profile, signOut, isAdmin } = useAuth()
  const navigate = useNavigate()
  const nav = isAdmin ? adminNav : freelancerNav
  const [notifOpen, setNotifOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div>
      {/* HEADER */}
      <header className="header">
        <div style={{ flex: 1, fontSize: 18, fontWeight: 700, color: 'var(--pr)', letterSpacing: -0.5 }}>
          Vania<span style={{ color: '#8fa8bc', fontWeight: 400 }}>Graphics</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <div className="nav-item" style={{ width: 36, height: 36, padding: 0, justifyContent: 'center', fontSize: 16, borderRadius: '50%' }} onClick={() => setNotifOpen(!notifOpen)}>
              🔔
              <div style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: '#e53935', border: '1.5px solid white' }}></div>
            </div>
          </div>
          <div
            style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--pr)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            onClick={() => navigate('/indstillinger')}
          >
            {profile?.navn?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'MK'}
          </div>
        </div>
      </header>

      {/* DRAWER */}
      <nav className="drawer">
        <div className="nav-section">Menu</div>
        {nav.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
        <div className="nav-section" style={{ marginTop: 8 }}>System</div>
        <NavLink to="/indstillinger" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>⚙</span>
          Indstillinger
        </NavLink>
        <div className="nav-item" onClick={handleSignOut} style={{ marginTop: 'auto', color: 'var(--muted)' }}>
          <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>🔒</span>
          Log ud
        </div>
      </nav>

      {/* MAIN */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
