import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

// Under denne bredde ligger menuen skjult og glider ind over indholdet, når man trykker ☰
const MOBIL_BREDDE = 900
const SKJULT_KEY = 'fotoflow_menu_skjult'

function erMobil() {
  return typeof window !== 'undefined' && window.innerWidth < MOBIL_BREDDE
}

export default function Layout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [afventerCount, setAfventerCount] = useState(0)
  const [mobil, setMobil] = useState(erMobil)
  // Computer: menuen kan foldes sammen til en smal ikon-bjælke (huskes i browseren)
  const [foldet, setFoldet] = useState(() => {
    try { return localStorage.getItem(SKJULT_KEY) === '1' } catch { return false }
  })
  // Mobil: menuen er lukket som udgangspunkt og åbnes som skuffe
  const [skuffeÅben, setSkuffeÅben] = useState(false)

  useEffect(() => {
    fetchAfventerCount()
    // Opdater hvert minut
    const interval = setInterval(fetchAfventerCount, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const onResize = () => setMobil(erMobil())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Luk skuffen når man har valgt en side
  useEffect(() => { setSkuffeÅben(false) }, [location.pathname])

  // Lås baggrunden mens skuffen er åben på mobil
  useEffect(() => {
    document.body.style.overflow = mobil && skuffeÅben ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobil, skuffeÅben])

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

  function skiftMenu() {
    if (mobil) { setSkuffeÅben(v => !v); return }
    setFoldet(v => {
      try { localStorage.setItem(SKJULT_KEY, v ? '0' : '1') } catch {}
      return !v
    })
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
    { to: '/fakturaer', label: 'Fakturaer', icon: '🧾' },
  ]

  // På mobil vises altid fulde navne i skuffen; på computer kan menuen være foldet til ikoner
  const smal = !mobil && foldet
  const menuBredde = mobil ? 0 : (smal ? 60 : 200)
  const menuSynlig = !mobil || skuffeÅben

  const linkStyle = ({ isActive }) => ({
    display: 'flex', alignItems: 'center', gap: 9, padding: mobil ? '12px 12px' : '8px 10px', borderRadius: 8,
    fontSize: mobil ? 15 : 13, justifyContent: smal ? 'center' : 'flex-start',
    fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--pr)' : 'var(--tx)',
    background: isActive ? 'var(--pr-light, #eef4f8)' : 'transparent',
    textDecoration: 'none', marginBottom: 2, position: 'relative', transition: 'background .15s'
  })
  const sektionStyle = { fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', padding: '8px 10px 4px' }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Mørk baggrund bag skuffen på mobil – tryk for at lukke */}
      {mobil && skuffeÅben && (
        <div onClick={() => setSkuffeÅben(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 40 }} />
      )}

      {/* SIDEBAR */}
      <div className="sidebar" style={{
        width: mobil ? 'min(280px, 82vw)' : menuBredde, background: 'var(--surf)', borderRight: '.5px solid var(--brd)',
        display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: mobil ? 50 : 10,
        transform: menuSynlig ? 'none' : 'translateX(-100%)', transition: 'transform .22s ease, width .18s ease',
        boxShadow: mobil && skuffeÅben ? '0 0 24px rgba(0,0,0,.18)' : 'none', overflowX: 'hidden',
      }}>
        {/* LOGO */}
        <div style={{ padding: smal ? '18px 0 12px' : '18px 20px 12px', borderBottom: '.5px solid var(--brd)', display: 'flex', alignItems: 'center', justifyContent: smal ? 'center' : 'space-between', minHeight: 57 }}>
          {smal
            ? <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--pr)' }}>V</div>
            : <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--pr)', whiteSpace: 'nowrap' }}>Vania<span style={{ color: 'var(--tx)', fontWeight: 400 }}>Graphics</span></div>}
          {mobil && (
            <button onClick={() => setSkuffeÅben(false)} aria-label="Luk menu"
              style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--muted)', width: 40, height: 40, cursor: 'pointer' }}>✕</button>
          )}
        </div>

        {/* NAV */}
        <nav style={{ flex: 1, padding: smal ? '10px 6px' : '10px 10px', overflowY: 'auto' }}>
          {!smal && <div style={sektionStyle}>MENU</div>}

          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end} style={linkStyle} title={smal ? item.label : undefined}>
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              {!smal && <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{item.label}</span>}
              {item.badge > 0 && (
                <span style={{
                  background: '#e53e3e', color: '#fff', borderRadius: 20,
                  fontSize: 10, fontWeight: 700, padding: '1px 6px', minWidth: 18, textAlign: 'center',
                  ...(smal ? { position: 'absolute', top: 2, right: 2 } : {})
                }}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}

          {smal
            ? <div style={{ borderTop: '.5px solid var(--brd)', margin: '8px 4px' }} />
            : <div style={{ ...sektionStyle, padding: '12px 10px 4px', marginTop: 4, borderTop: '.5px solid var(--brd)' }}>SYSTEM</div>}
          <NavLink to="/indstillinger" style={linkStyle} title={smal ? 'Indstillinger' : undefined}>
            <span style={{ fontSize: 15 }}>⚙</span>{!smal && ' Indstillinger'}
          </NavLink>
          <div onClick={handleSignOut} title={smal ? 'Log ud' : undefined}
            style={{ ...linkStyle({ isActive: false }), color: 'var(--muted)', cursor: 'pointer' }}>
            <span style={{ fontSize: 15 }}>🔒</span>{!smal && ' Log ud'}
          </div>
        </nav>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, minWidth: 0, marginLeft: menuBredde, display: 'flex', flexDirection: 'column', minHeight: '100vh', transition: 'margin-left .18s ease' }}>
        {/* TOPBAR */}
        <div className="topbar" style={{ background: 'var(--surf)', borderBottom: '.5px solid var(--brd)', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 5 }}>
          <button onClick={skiftMenu} aria-label={mobil ? 'Åbn menu' : (foldet ? 'Vis menu' : 'Skjul menu')}
            title={mobil ? 'Menu' : (foldet ? 'Vis menu' : 'Skjul menu')}
            style={{ background: 'none', border: 'none', width: 40, height: 40, borderRadius: 8, fontSize: 22, color: 'var(--pr)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            ☰
          </button>
          {mobil && (
            <div onClick={() => navigate('/')} style={{ fontSize: 16, fontWeight: 800, color: 'var(--pr)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Vania<span style={{ color: 'var(--tx)', fontWeight: 400 }}>Graphics</span>
            </div>
          )}
          <div style={{ flex: 1 }} />
          {afventerCount > 0 && (
            <div onClick={() => navigate('/bookinger')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff5f5', border: '1px solid #feb2b2', color: '#c53030', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              🔔 {afventerCount}{mobil ? '' : ` booking${afventerCount > 1 ? 'er' : ''} afventer`}
            </div>
          )}
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--pr)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>D</div>
        </div>

        {/* CONTENT */}
        <div className="layout-content" style={{ flex: 1 }}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
