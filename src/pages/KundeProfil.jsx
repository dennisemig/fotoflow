import { useNavigate } from 'react-router-dom'
export default function KundeProfil() {
  const navigate = useNavigate()
  return <div><div className="page-title" style={{cursor:'pointer',fontSize:14,fontWeight:500,color:'var(--muted)',marginBottom:8}} onClick={()=>navigate('/kunder')}>← Tilbage</div><div className="page-title">Kundeprofil</div><div className="card">Kundeprofil indlæses...</div></div>
}
