export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { type, mægler } = req.body
  const KEY = process.env.RESEND_API_KEY
  const FROM = `VaniaGraphics <${process.env.RESEND_FROM || 'dennis@vaniagraphics.dk'}>`
  const APP_URL = process.env.VITE_APP_URL || 'https://fotoflow-theta.vercel.app'

  const emails = {
    freelancer_booking: {
      to: mægler?.email, subject: `Ny sag tildelt – ${mægler?.adresse}`,
      html: `<div style="font-family:system-ui;max-width:520px;margin:0 auto"><div style="background:#3A4A5A;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0"><b style="font-size:18px">📷 VaniaGraphics</b><div style="opacity:.75;font-size:13px">Ny sag tildelt</div></div><div style="background:#fff;border:1px solid #e5e7eb;padding:24px;border-radius:0 0 10px 10px"><p>Hej ${mægler?.navn || ''},</p><p style="margin:12px 0">Du er booket på en ny fotograferingssag:</p><div style="background:#f4f5f7;border-radius:8px;padding:16px;margin:16px 0"><div style="margin-bottom:6px"><b>Adresse:</b> ${mægler?.adresse}</div><div style="margin-bottom:6px"><b>Dato:</b> ${mægler?.dato}</div><div><b>Tidspunkt:</b> ${mægler?.tidspunkt || 'Aftales'}</div></div><a href="${APP_URL}/freelancer" style="display:inline-block;background:#3A4A5A;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">Log ind og se sagen →</a><p style="margin-top:20px;font-size:12px;color:#6b7280">Med venlig hilsen,<br>Dennis – VaniaGraphics</p></div></div>`
    },
    freelancer_invitation: {
      to: mægler?.email, subject: 'Du er inviteret som freelancer – VaniaGraphics',
      html: `<div style="font-family:system-ui;max-width:520px;margin:0 auto"><div style="background:#3A4A5A;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0"><b style="font-size:18px">📷 VaniaGraphics</b><div style="opacity:.75;font-size:13px">Invitation som freelancer</div></div><div style="background:#fff;border:1px solid #e5e7eb;padding:24px;border-radius:0 0 10px 10px"><p>Hej ${mægler?.navn},</p><p style="margin:12px 0">Du er blevet tilføjet som freelancerfotograf hos VaniaGraphics. Klik på linket herunder for at oprette din adgangskode og komme i gang.</p><a href="${APP_URL}/login" style="display:inline-block;background:#3A4A5A;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">Opret din adgang →</a><p style="margin-top:12px;font-size:12px;color:#6b7280">Har du spørgsmål? Kontakt Dennis på dennis@vaniagraphics.dk</p><p style="margin-top:20px;font-size:12px;color:#6b7280">Med venlig hilsen,<br>Dennis – VaniaGraphics</p></div></div>`
    },
    ny_booking: {
      to: process.env.RESEND_FROM, subject: `⚡ Ny booking fra mægler – ${mægler?.adresse}`,
      html: `<div style="font-family:system-ui;max-width:520px;margin:0 auto"><div style="background:#2e7d4f;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0"><b style="font-size:18px">🔔 Ny booking!</b></div><div style="background:#fff;border:1px solid #e5e7eb;padding:24px;border-radius:0 0 10px 10px"><div style="background:#f4f5f7;border-radius:8px;padding:16px"><div style="margin-bottom:6px"><b>Adresse:</b> ${mægler?.adresse}</div><div style="margin-bottom:6px"><b>Dato:</b> ${mægler?.dato}</div><div style="margin-bottom:6px"><b>Mægler:</b> ${mægler?.maegler_navn} · ${mægler?.maegler_firma || ''}</div><div style="margin-bottom:6px"><b>Email:</b> ${mægler?.maegler_email}</div><div style="margin-bottom:6px"><b>Pakke:</b> ${mægler?.pakke}</div><div><b>Total:</b> ${mægler?.total?.toLocaleString('da-DK') || '—'} kr</div></div><a href="${APP_URL}" style="display:inline-block;background:#3A4A5A;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px">Gå til systemet →</a></div></div>`
    },
    levering: {
      to: mægler?.email, subject: `Dine billeder er klar – ${mægler?.adresse}`,
      html: `<div style="font-family:system-ui;max-width:520px;margin:0 auto"><div style="background:#3A4A5A;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0"><b style="font-size:18px">📷 VaniaGraphics</b><div style="opacity:.75;font-size:13px">Dine billeder er klar</div></div><div style="background:#fff;border:1px solid #e5e7eb;padding:24px;border-radius:0 0 10px 10px"><p>Hej ${mægler?.navn || ''},</p><p style="margin:12px 0">Billederne fra <b>${mægler?.adresse}</b> er nu redigeret og klar til levering.</p><p>Du kan se et preview her – del gerne linket med sælger til gennemsyn:</p><a href="${mægler?.previewLink || APP_URL}" style="display:inline-block;background:#3A4A5A;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;margin:12px 0">Se billeder →</a><p style="font-size:12px;color:#6b7280">Billederne er samtidig leveret direkte i dit mæglersystem via Mindworking.</p><p style="margin-top:20px;font-size:12px;color:#6b7280">Med venlig hilsen,<br>Dennis – VaniaGraphics</p></div></div>`
    },
    booking_bekraeft: {
      to: mægler?.email, subject: `✓ Booking bekræftet – ${mægler?.adresse}`,
      html: `<div style="font-family:system-ui;max-width:520px;margin:0 auto"><div style="background:#2e7d4f;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0"><b style="font-size:18px">✓ Booking bekræftet</b></div><div style="background:#fff;border:1px solid #e5e7eb;padding:24px;border-radius:0 0 10px 10px"><p>Hej ${mægler?.maegler_navn || ''},</p><p style="margin:12px 0">Din booking er bekræftet:</p><div style="background:#f4f5f7;border-radius:8px;padding:16px"><div style="margin-bottom:6px"><b>Adresse:</b> ${mægler?.adresse}</div><div style="margin-bottom:6px"><b>Dato:</b> ${mægler?.dato}</div><div><b>Pakke:</b> ${mægler?.pakke}</div></div><p style="margin-top:20px;font-size:12px;color:#6b7280">Med venlig hilsen,<br>Dennis – VaniaGraphics</p></div></div>`
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
