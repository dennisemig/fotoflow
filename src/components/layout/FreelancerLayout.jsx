import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'

const navItems = [
  { to: '/freelancer', label: 'Mine sager', icon: '📋', exact: true },
  { to: '/freelancer/sager', label: 'Upload billeder', icon: '⬆' },
  { to: '/freelancer/koersel', label: 'Kørselsrapport', icon: '🚗' },
]

export default function FreelancerLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const initials = profile?.navn
    ? profile.navn.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'FL'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: 'var(--header-h)', background: 'var(--surf)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)', zIndex: 100,
        display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--pr)', flex: 1 }}>
          Vania<span style={{ color: '#8fa8bc', fontWeight: 400 }}>Graphics</span>
          <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8, fontWeight: 400 }}>Freelancer</span>
        </div>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{profile?.navn}</span>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', background: 'var(--pr)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 600, cursor: 'pointer'
        }} onClick={async () => { await signOut(); navigate('/login') }}>
          {initials}
        </div>
      </header>

      <nav style={{
        position: 'fixed', top: 'var(--header-h)', left: 0, bottom: 0,
        width: 'var(--drawer-w)', background: '#f7f7f7',
        borderRight: '0.5px solid var(--brd)', zIndex: 90,
        padding: '16px 10px'
      }}>
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} end={item.exact}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', borderRadius: 8, fontSize: 13.5,
              fontWeight: 500, marginBottom: 2,
              background: isActive ? 'var(--pr)' : 'transparent',
              color: isActive ? '#fff' : 'var(--txt)',
              textDecoration: 'none'
            })}>
            <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main style={{ marginLeft: 'var(--drawer-w)', marginTop: 'var(--header-h)', padding: 24 }}>
        <Outlet />
      </main>
    </div>
  )
}
