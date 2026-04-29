export default function Booking() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surf)', borderRadius: 14, border: '0.5px solid var(--brd)', overflow: 'hidden', width: 480, maxWidth: '95vw' }}>
        <div style={{ background: 'var(--pr)', padding: '20px 24px', color: '#fff' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>📷 VaniaGraphics</div>
          <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>Book en fotografering</div>
        </div>
        <div style={{ padding: 24 }}>
          <div className="form-group"><label>Ejendomsadresse</label><input placeholder="Skriv adressen..." /></div>
          <div className="form-group"><label>Vælg dato</label><input type="date" /></div>
          <div className="form-group"><label>Kontaktperson</label><input placeholder="Dit navn" /></div>
          <div className="form-group"><label>Email</label><input type="email" placeholder="din@mægler.dk" /></div>
          <div className="form-group">
            <label>Pakke</label>
            <select><option>Standard – op til 20 billeder (2.995 kr)</option><option>Premium – op til 35 billeder (4.495 kr)</option><option>Basis – op til 10 billeder (1.995 kr)</option></select>
          </div>
          <div className="form-group"><label>Noter</label><textarea rows={3} placeholder="Adgangskode, særlige ønsker..." /></div>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Send booking →</button>
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>Bookingen bekræftes inden for 2 timer</div>
        </div>
      </div>
    </div>
  )
}
