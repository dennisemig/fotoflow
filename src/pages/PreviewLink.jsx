import { useParams } from 'react-router-dom'
export default function PreviewLink() {
  const { token } = useParams()
  return <div style={{ minHeight: '100vh', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#fff', textAlign: 'center' }}><div style={{ fontSize: 32, marginBottom: 16 }}>📸</div><div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Billedpræsentation</div><div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Token: {token}</div></div></div>
}
