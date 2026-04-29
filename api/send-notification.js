// api/send-notification.js
// Vercel Serverless Function – kører server-side

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { type, sagId, freelancerId, mægler } = req.body
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  const FROM = process.env.RESEND_FROM || 'dennis@vaniagraphics.dk'

  let emailData = {}

  if (type === 'freelancer_booking') {
    emailData = {
      from: `VaniaGraphics <${FROM}>`,
      to: mægler?.email || 'freelancer@example.dk',
      subject: `Ny sag tildelt – ${mægler?.adresse || 'Se detaljer'}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px">
          <div style="background:#3A4A5A;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0">
            <div style="font-size:18px;font-weight:700">📷 VaniaGraphics</div>
            <div style="opacity:0.75;font-size:13px;margin-top:2px">Ny sag tildelt</div>
          </div>
          <div style="background:#fff;border:0.5px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 10px 10px">
            <p>Hej,</p>
            <p>Du er booket på en ny fotograferingssag:</p>
            <div style="background:#f4f5f7;border-radius:8px;padding:16px;margin:16px 0">
              <div style="margin-bottom:8px"><strong>Adresse:</strong> ${mægler?.adresse || '—'}</div>
              <div style="margin-bottom:8px"><strong>Dato:</strong> ${mægler?.dato || '—'}</div>
              <div><strong>Tidspunkt:</strong> ${mægler?.tidspunkt || '—'}</div>
            </div>
            <p>Log ind for at se alle detaljer og uploade dine billeder:</p>
            <a href="${process.env.VITE_APP_URL}/freelancer" style="display:inline-block;background:#3A4A5A;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">Gå til sagen →</a>
            <p style="margin-top:20px;font-size:12px;color:#6b7280">Med venlig hilsen,<br>Dennis – VaniaGraphics</p>
          </div>
        </div>
      `
    }
  } else if (type === 'levering') {
    emailData = {
      from: `VaniaGraphics <${FROM}>`,
      to: mægler?.email,
      subject: `Dine billeder er klar – ${mægler?.adresse}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px">
          <div style="background:#3A4A5A;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0">
            <div style="font-size:18px;font-weight:700">📷 VaniaGraphics</div>
            <div style="opacity:0.75;font-size:13px;margin-top:2px">Dine billeder er klar</div>
          </div>
          <div style="background:#fff;border:0.5px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 10px 10px">
            <p>Hej ${mægler?.navn || ''},</p>
            <p>Billederne fra <strong>${mægler?.adresse}</strong> er nu redigeret og klar.</p>
            <p>Du kan se et preview her – del gerne linket med sælger:</p>
            <a href="${process.env.VITE_APP_URL}/preview/${mægler?.previewId}" style="display:inline-block;background:#3A4A5A;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">Se billeder →</a>
            <p style="margin-top:8px;font-size:12px;color:#6b7280">Billederne er samtidig leveret direkte i dit mæglersystem via Mindworking.</p>
            <p style="margin-top:20px;font-size:12px;color:#6b7280">Med venlig hilsen,<br>Dennis – VaniaGraphics</p>
          </div>
        </div>
      `
    }
  } else if (type === 'booking_bekraeft') {
    emailData = {
      from: `VaniaGraphics <${FROM}>`,
      to: mægler?.email,
      subject: `Booking bekræftet – ${mægler?.adresse}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px">
          <div style="background:#2e7d4f;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0">
            <div style="font-size:18px;font-weight:700">✓ Booking bekræftet</div>
          </div>
          <div style="background:#fff;border:0.5px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 10px 10px">
            <p>Hej ${mægler?.navn || ''},</p>
            <p>Din booking er bekræftet:</p>
            <div style="background:#f4f5f7;border-radius:8px;padding:16px;margin:16px 0">
              <div style="margin-bottom:8px"><strong>Adresse:</strong> ${mægler?.adresse}</div>
              <div style="margin-bottom:8px"><strong>Dato:</strong> ${mægler?.dato}</div>
              <div><strong>Pakke:</strong> ${mægler?.pakke}</div>
            </div>
            <p style="font-size:12px;color:#6b7280">Med venlig hilsen,<br>Dennis – VaniaGraphics</p>
          </div>
        </div>
      `
    }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(emailData)
    })
    const data = await response.json()
    res.status(200).json({ success: true, id: data.id })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
