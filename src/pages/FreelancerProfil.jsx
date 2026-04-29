import { useNavigate } from 'react-router-dom'
export default function FreelancerProfil() {
  const navigate = useNavigate()
  return <div><div style={{cursor:'pointer',fontSize:14,color:'var(--muted)',marginBottom:8}} onClick={()=>navigate('/freelancere')}>← Tilbage til freelancere</div><div className="page-title">Freelancer profil</div><div className="card">Profil indlæses...</div></div>
}
