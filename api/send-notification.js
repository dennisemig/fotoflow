export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { type, mægler } = req.body
  const KEY = process.env.RESEND_API_KEY
  const FROM = `VaniaGraphics <${process.env.RESEND_FROM || 'dennis@vaniagraphics.dk'}>`
  const APP_URL = process.env.VITE_APP_URL || 'https://app.vaniagraphics.dk'

  const emails = {
    freelancer_booking: {
      to: mægler?.email,
      subject: `Ny sag tildelt – ${mægler?.adresse}`,
      html: `<div style="font-family:system-ui;max-width:520px;margin:0 auto">
        <div style="background:#3A4A5A;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0"><b style="font-size:18px">📷 VaniaGraphics</b></div>
        <div style="background:#fff;border:1px solid #e5e7eb;padding:24px;border-radius:0 0 10px 10px">
          <p>Hej ${mægler?.navn || ''},</p>
          <p>Du er booket på en ny sag:</p>
          <div style="background:#f4f5f7;border-radius:8px;padding:16px;margin:16px 0">
            <div style="margin-bottom:6px"><b>Adresse:</b> ${mægler?.adresse}</div>
            <div style="margin-bottom:6px"><b>Dato:</b> ${mægler?.dato}</div>
            <div style="margin-bottom:6px"><b>Tidspunkt:</b> ${mægler?.tidspunkt || '—'}</div>
            <div style="margin-bottom:6px"><b>Type:</b> ${mægler?.type || 'Ejendom'}</div>
            ${mægler?.noter ? `<div><b>Noter:</b> ${mægler.noter}</div>` : ''}
          </div>
          <p style="font-size:12px;color:#6b7280">Med venlig hilsen,<br>Dennis – VaniaGraphics</p>
        </div>
      </div>`
    },
    freelancer_invitation: {
      to: mægler?.email,
      subject: 'Du er inviteret som freelancer – VaniaGraphics',
      html: `<div style="font-family:system-ui;max-width:520px;margin:0 auto">
        <div style="background:#3A4A5A;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0"><b style="font-size:18px">📷 VaniaGraphics</b></div>
        <div style="background:#fff;border:1px solid #e5e7eb;padding:24px;border-radius:0 0 10px 10px">
          <p>Hej ${mægler?.navn},</p>
          <p>Du er tilføjet som freelancerfotograf hos VaniaGraphics.</p>
          <a href="${APP_URL}/login" style="display:inline-block;background:#3A4A5A;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">Opret din adgang →</a>
          <p style="font-size:12px;color:#6b7280">Med venlig hilsen,<br>Dennis – VaniaGraphics</p>
        </div>
      </div>`
    },
    ny_booking: {
      to: process.env.RESEND_FROM,
      subject: `⚡ Ny booking fra ${mægler?.maegler_navn || 'mægler'} – ${mægler?.adresse}`,
      html: `<div style="font-family:system-ui;max-width:520px;margin:0 auto">
        <div style="background:#2e7d4f;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0"><b style="font-size:18px">🔔 Ny booking!</b></div>
        <div style="background:#fff;border:1px solid #e5e7eb;padding:24px;border-radius:0 0 10px 10px">
          <div style="background:#f4f5f7;border-radius:8px;padding:16px">
            <div style="margin-bottom:6px"><b>Adresse:</b> ${mægler?.adresse}</div>
            <div style="margin-bottom:6px"><b>Dato:</b> ${mægler?.dato} · kl. ${mægler?.tidspunkt || '—'}</div>
            <div style="margin-bottom:6px"><b>Mægler:</b> ${mægler?.maegler_navn} · ${mægler?.maegler_firma || '—'}</div>
            <div style="margin-bottom:6px"><b>Email:</b> ${mægler?.maegler_email}</div>
            <div><b>Pakke:</b> ${mægler?.pakke}</div>
          </div>
          <a href="${APP_URL}/bookinger" style="display:inline-block;background:#3A4A5A;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px">Gå til bookinger →</a>
        </div>
      </div>`
    },
    booking_bekraeft: {
      to: mægler?.email,
      subject: `✓ Booking bekræftet – ${mægler?.adresse}`,
      html: `<div style="font-family:system-ui;max-width:520px;margin:0 auto">
        <div style="background:#2e7d4f;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0"><b style="font-size:18px">✓ Din booking er bekræftet</b></div>
        <div style="background:#fff;border:1px solid #e5e7eb;padding:24px;border-radius:0 0 10px 10px">
          <p>Hej ${mægler?.maegler_navn || ''},</p>
          <p>Din booking er bekræftet af VaniaGraphics:</p>
          <div style="background:#f4f5f7;border-radius:8px;padding:16px;margin:16px 0">
            <div style="margin-bottom:6px"><b>Adresse:</b> ${mægler?.adresse}</div>
            <div style="margin-bottom:6px"><b>Dato:</b> ${mægler?.dato}</div>
            <div style="margin-bottom:6px"><b>Tidspunkt:</b> kl. ${mægler?.tidspunkt || '—'}</div>
            <div style="margin-bottom:6px"><b>Pakke:</b> ${mægler?.pakke || '—'}</div>
            ${mægler?.tillaeg ? `<div><b>Tillæg:</b> ${mægler.tillaeg}</div>` : ''}
          </div>
          <p style="color:#6b7280;font-size:13px">Fotografen møder op til aftalt tid. Kontakt os på dennis@vaniagraphics.dk ved spørgsmål.</p>
          <p style="font-size:12px;color:#6b7280;margin-top:20px">Med venlig hilsen,<br>Dennis – VaniaGraphics</p>
        </div>
      </div>`
    },
    booking_afvist: {
      to: mægler?.email,
      subject: `Booking kan desværre ikke bekræftes – ${mægler?.adresse}`,
      html: `<div style="font-family:system-ui;max-width:520px;margin:0 auto">
        <div style="background:#c62828;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0"><b style="font-size:18px">Booking ikke mulig</b></div>
        <div style="background:#fff;border:1px solid #e5e7eb;padding:24px;border-radius:0 0 10px 10px">
          <p>Hej ${mægler?.maegler_navn || ''},</p>
          <p>Vi er desværre ikke i stand til at bekræfte din booking:</p>
          <div style="background:#f4f5f7;border-radius:8px;padding:16px;margin:16px 0">
            <div style="margin-bottom:6px"><b>Adresse:</b> ${mægler?.adresse}</div>
            <div><b>Ønsket dato:</b> ${mægler?.dato}</div>
          </div>
          <a href="${APP_URL}/book/vaniagraphics" style="display:inline-block;background:#3A4A5A;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">Book en ny tid →</a>
          <p style="font-size:12px;color:#6b7280;margin-top:20px">Med venlig hilsen,<br>Dennis – VaniaGraphics</p>
        </div>
      </div>`
    },
    levering: {
      to: mægler?.email,
      subject: `📸 Dine billeder er klar – ${mægler?.adresse}`,
      html: `<div style="font-family:system-ui;max-width:520px;margin:0 auto">
        <div style="background:#3A4A5A;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0">
          <b style="font-size:18px">📷 VaniaGraphics</b>
        </div>
        <div style="background:#fff;border:1px solid #e5e7eb;padding:24px;border-radius:0 0 10px 10px">
          <p style="font-size:15px;margin:0 0 12px">Hej ${mægler?.navn || ''},</p>
          <p style="margin:0 0 16px">Billederne fra <b>${mægler?.adresse}</b> er nu klar til dig.</p>
          <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px;margin-bottom:20px">
            <div style="margin-bottom:6px">📍 <b>Adresse:</b> ${mægler?.adresse}</div>
            <div style="margin-bottom:6px">📅 <b>Fotograferingsdato:</b> ${mægler?.dato}</div>
            <div>🖼 <b>Antal billeder:</b> ${mægler?.antal_billeder || 0}</div>
          </div>
          <div style="text-align:center;margin:24px 0">
            <a href="${mægler?.galleri_link}" style="display:inline-block;background:#3A4A5A;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px">
              📸 Se og download dine billeder →
            </a>
          </div>
          <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;font-size:12px;color:#92400e;margin-bottom:16px">
            ⏳ <b>Vigtigt:</b> Billederne er kun tilgængelige i 7 dage. Download dem inden ${new Date(Date.now() + 7*24*60*60*1000).toLocaleDateString('da-DK')}.
          </div>
          <p style="font-size:12px;color:#9ca3af;margin:0">Kontakt os på dennis@vaniagraphics.dk ved spørgsmål.</p>
          <p style="font-size:12px;color:#6b7280;margin:12px 0 0">Med venlig hilsen,<br>Dennis – VaniaGraphics</p>
        </div>
      </div>`
    }
    }

  const emailData = emails[type]
  if (!emailData || !emailData.to) return res.status(400).json({ error: 'Invalid type or missing email' })

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, ...emailData })
    })
    const data = await r.json()
    res.status(200).json({ success: true, id: data.id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
