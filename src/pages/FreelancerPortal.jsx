export default function FreelancerPortal() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surf)', borderRadius: 14, border: '0.5px solid var(--brd)', padding: 40, width: 360 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--pr)', textAlign: 'center', marginBottom: 6 }}>📷 Freelancer Login</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', marginBottom: 24 }}>VaniaGraphics</div>
        <div className="form-group"><label>Email</label><input type="email" placeholder="din@email.dk" /></div>
        <div className="form-group"><label>Adgangskode</label><input type="password" placeholder="••••••••" /></div>
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Log ind</button>
      </div>
    </div>
  )
}
