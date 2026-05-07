const RESEND_KEY = process.env.RESEND_API_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY
const APP_URL = process.env.VITE_APP_URL || 'https://app.vaniagraphics.dk'

export default async function handler(req, res) {
  // Verificer at det er et legitimt cron kald
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    // Find morgendagens dato
    const imorgen = new Date()
    imorgen.setDate(imorgen.getDate() + 1)
    const datoStr = imorgen.toISOString().split('T')[0]
    const datoLabel = imorgen.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

    // Hent sager fra Supabase
    const r = await fetch(`${SUPABASE_URL}/rest/v1/sager?dato=eq.${datoStr}&status=neq.afsluttet&status=neq.leveret&select=adresse,tidspunkt,tidspunkt_slut,type,maegler_navn,freelancer_id,noter&order=tidspunkt.asc.nullslast`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    })
    const sager = await r.json()

    if (!sager.length) {
      console.log('Ingen sager i morgen – ingen mail sendt')
      return res.status(200).json({ success: true, message: 'Ingen sager i morgen' })
    }

    // Byg HTML mail
    const sagsRækker = sager.map(s => `
      <tr>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #3A4A5A;">
          ${s.tidspunkt ? String(s.tidspunkt).slice(0,5) : '—'}${s.tidspunkt_slut ? ` – ${String(s.tidspunkt_slut).slice(0,5)}` : ''}
        </td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb;">${s.adresse}</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${s.maegler_navn || '—'}</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; color: #6b7280; text-transform: capitalize;">${s.type || 'ejendom'}</td>
      </tr>
    `).join('')

    const html = `
      <div style="font-family: system-ui; max-width: 600px; margin: 0 auto;">
        <div style="background: #3A4A5A; color: #fff; padding: 20px 24px; border-radius: 10px 10px 0 0;">
          <b style="font-size: 18px">📷 VaniaGraphics – Dagens opgaver</b>
          <div style="font-size: 13px; opacity: .75; margin-top: 4px; text-transform: capitalize;">${datoLabel}</div>
        </div>
        <div style="background: #fff; border: 1px solid #e5e7eb; padding: 24px; border-radius: 0 0 10px 10px;">
          <p>Hej Dennis,</p>
          <p>Her er dine opgaver for <b>${datoLabel}</b>:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
            <thead>
              <tr style="background: #f4f5f7;">
                <th style="padding: 8px 14px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: .05em;">Tid</th>
                <th style="padding: 8px 14px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: .05em;">Adresse</th>
                <th style="padding: 8px 14px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: .05em;">Mægler</th>
                <th style="padding: 8px 14px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: .05em;">Type</th>
              </tr>
            </thead>
            <tbody>${sagsRækker}</tbody>
          </table>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${APP_URL}/kalender" style="display: inline-block; background: #3A4A5A; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
              Se kalender →
            </a>
          </div>
          <p style="font-size: 12px; color: #9ca3af; margin-top: 16px;">Du har ${sager.length} opgave${sager.length !== 1 ? 'r' : ''} i morgen.</p>
        </div>
      </div>
    `

    // Send mail via Resend
    const mailR = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `VaniaGraphics <${process.env.RESEND_FROM || 'dennis@vaniagraphics.dk'}>`,
        to: 'dennis@vaniagraphics.dk',
        subject: `📅 ${sager.length} opgave${sager.length !== 1 ? 'r' : ''} i morgen – ${datoLabel}`,
        html
      })
    })

    const mailData = await mailR.json()
    console.log('Mail sendt:', mailData.id)
    res.status(200).json({ success: true, sager: sager.length, mailId: mailData.id })

  } catch (e) {
    console.error('Daglig mail fejl:', e)
    res.status(500).json({ error: e.message })
  }
}
