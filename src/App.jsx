import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Sager from './pages/Sager'
import SagDetalje from './pages/SagDetalje'
import Kunder from './pages/Kunder'
import KundeProfil from './pages/KundeProfil'
import Kalender from './pages/Kalender'
import Freelancere from './pages/Freelancere'
import FreelancerProfil from './pages/FreelancerProfil'
import Koersel from './pages/Koersel'
import Pakker from './pages/Pakker'
import Bookinger from './pages/Bookinger'
import Indstillinger from './pages/Indstillinger'
import Booking from './pages/Booking'
import Levering from './pages/Levering'

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12, color: 'var(--muted)' }}>
      <div style={{ fontSize: 32 }}>📷</div>
      <div style={{ fontWeight: 600, color: 'var(--pr)' }}>VaniaGraphics indlæser...</div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/book/:slug" element={<Booking />} />
      <Route path="/levering/:token" element={<Levering />} />
      <Route path="/" element={<Protected><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="sager" element={<Sager />} />
        <Route path="sager/:id" element={<SagDetalje />} />
        <Route path="kunder" element={<Kunder />} />
        <Route path="kunder/:id" element={<KundeProfil />} />
        <Route path="kalender" element={<Kalender />} />
        <Route path="freelancere" element={<Freelancere />} />
        <Route path="freelancere/:id" element={<FreelancerProfil />} />
        <Route path="koersel" element={<Koersel />} />
        <Route path="pakker" element={<Pakker />} />
        <Route path="bookinger" element={<Bookinger />} />
        <Route path="indstillinger" element={<Indstillinger />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return <AuthProvider><AppRoutes /></AuthProvider>
}
