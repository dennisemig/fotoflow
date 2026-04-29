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
import Upload from './pages/Upload'
import Freelancere from './pages/Freelancere'
import FreelancerProfil from './pages/FreelancerProfil'
import Koersel from './pages/Koersel'
import Indstillinger from './pages/Indstillinger'
import Booking from './pages/Booking'
import FreelancerPortal from './pages/FreelancerPortal'

function ProtectedRoute({ children, role }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'var(--muted)'}}>Indlæser...</div>
  if (!user) return <Navigate to="/login" />
  if (role && profile?.role !== role) return <Navigate to="/" />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/book/:slug" element={<Booking />} />
      <Route path="/freelancer" element={<FreelancerPortal />} />

      {/* Protected admin routes */}
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="sager" element={<Sager />} />
        <Route path="sager/:id" element={<SagDetalje />} />
        <Route path="kunder" element={<Kunder />} />
        <Route path="kunder/:id" element={<KundeProfil />} />
        <Route path="kalender" element={<Kalender />} />
        <Route path="upload" element={<Upload />} />
        <Route path="freelancere" element={<Freelancere />} />
        <Route path="freelancere/:id" element={<FreelancerProfil />} />
        <Route path="koersel" element={<Koersel />} />
        <Route path="indstillinger" element={<Indstillinger />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
