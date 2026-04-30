import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function Layout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [afventerCount, setAfventerCount] = useState(0)

  useEffect(() => {
    fetchAfventerCount()
    // Opdater hvert minut
    const interval = setInterval(fetchAfventerCount, 60000)
    return () => clearInterval(interval)
  }, [])

  async function fetchAfventerCount() {
    const { count } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'afventer')
    setAfventerCount(count || 0)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const navItems = [
    { to: '/', label: 'Dashboard', icon: '⊞', end: true },
    { to: '/sager', label: 'Sager', icon: '📋' },
    { to: '/kunder', label: 'Kunder (CRM)', icon: '👥' },
    { to: '/kalender', label: 'Kalender', icon: '📅' },
    { to: '/freelancere', label: 'Freelancere', icon: '📷' },
    { to: '/koersel', label: 'Kørselsrapport', icon: '🚗' },
    { to: '/pakker', label: 'Pakker & Tillæg', icon: '📦' },
    { to: '/bookinger', label: 'Bookinger', icon: '🔔', badge: afventerCount },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* SIDEBAR */}
      <div style={{ width: 200, background: 'var(--surf)', borderRight: '.5px solid var(--brd)', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 10 }}>
        {/* LOGO */}
        <div style={{ padding: '18px 20px 12px', borderBottom: '.5px solid var(--brd)' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--pr)' }}>Vania<span style={{ color: 'var(--tx)', fontWeight: 400 }}>Graphics</span></div>
        </div>

        {/* NAV */}
        <nav style={{ flex: 1, padding: '10px 10px', overflowY: 'auto' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', padding: '8px 10px 4px' }}>MENU</div>

          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, fontSize: 13,
                fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--pr)' : 'var(--tx)',
                background: isActive ? 'var(--pr-light, #eef4f8)' : 'transparent',
                textDecoration: 'none', marginBottom: 2, position: 'relative', transition: 'background .15s'
              })}>
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge > 0 && (
                <span style={{
                  background: '#e53e3e', color: '#fff', borderRadius: 20,
                  fontSize: 10, fontWeight: 700, padding: '1px 6px', minWidth: 18, textAlign: 'center'
                }}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}

          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', padding: '12px 10px 4px', marginTop: 4, borderTop: '.5px solid var(--brd)' }}>SYSTEM</div>
          <NavLink to="/indstillinger"
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, fontSize: 13,
              fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--pr)' : 'var(--tx)',
              background: isActive ? 'var(--pr-light, #eef4f8)' : 'transparent',
              textDecoration: 'none', marginBottom: 2
            })}>
            <span style={{ fontSize: 15 }}>⚙</span> Indstillinger
          </NavLink>
          <div onClick={handleSignOut}
            style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, fontSize: 13, color: 'var(--muted)', cursor: 'pointer', marginBottom: 2 }}>
            <span style={{ fontSize: 15 }}>🔒</span> Log ud
          </div>
        </nav>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, marginLeft: 200, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* TOPBAR */}
        <div style={{ background: 'var(--surf)', borderBottom: '.5px solid var(--brd)', padding: '10px 28px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, position: 'sticky', top: 0, zIndex: 5 }}>
          {afventerCount > 0 && (
            <div onClick={() => navigate('/bookinger')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff5f5', border: '1px solid #feb2b2', color: '#c53030', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              🔔 {afventerCount} booking{afventerCount > 1 ? 'er' : ''} afventer
            </div>
          )}
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--pr)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15 }}>D</div>
        </div>

        {/* CONTENT */}
        <div style={{ padding: '24px 28px', flex: 1 }}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
