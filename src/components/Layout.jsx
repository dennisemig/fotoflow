import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const nav = [
  { to: '/', icon: '⊞', label: 'Dashboard', end: true },
  { to: '/sager', icon: '📋', label: 'Sager' },
  { to: '/kunder', icon: '👥', label: 'Kunder (CRM)' },
  { to: '/kalender', icon: '📅', label: 'Kalender' },
  { to: '/freelancere', icon: '📷', label: 'Freelancere' },
  { to: '/koersel', icon: '🚗', label: 'Kørselsrapport' },
  { to: '/pakker', icon: '📦', label: 'Pakker & Tillæg' },
  { to: '/bookinger', icon: '🔔', label: 'Bookinger' },
]

export default function Layout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const initials = profile?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'VG'

  return (
    <>
      <header className="header">
        <div style={{ flex: 1, fontSize: 18, fontWeight: 700, color: 'var(--pr)', letterSpacing: -0.5 }}>
          Vania<span style={{ color: '#8fa8bc', fontWeight: 400 }}>Graphics</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--pr)', fontSize: 16 }}>🔔</div>
          <div onClick={() => navigate('/indstillinger')}
            style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--pr)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {initials}
          </div>
        </div>
      </header>
      <nav className="drawer">
        <div className="nav-section">Menu</div>
        {nav.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">{item.icon}</span>{item.label}
          </NavLink>
        ))}
        <div className="nav-section" style={{ marginTop: 8 }}>System</div>
        <NavLink to="/indstillinger" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span className="nav-icon">⚙</span>Indstillinger
        </NavLink>
        <div className="nav-item" onClick={async () => { await signOut(); navigate('/login') }}>
          <span className="nav-icon">🔒</span>Log ud
        </div>
      </nav>
      <main className="main-content"><Outlet /></main>
    </>
  )
}
