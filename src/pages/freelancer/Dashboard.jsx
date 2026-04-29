import { useAuth } from '../../lib/AuthContext'
export default function FreelancerDashboard() {
  const { profile } = useAuth()
  return <div><div className="page-title">Hej {profile?.navn?.split(' ')[0] || 'Freelancer'} 👋</div><div className="card"><div style={{ color: 'var(--muted)', textAlign: 'center', padding: 32 }}>Dine sager vises her</div></div></div>
}
