import { byggMails } from './_lib/mails.js'
import { kraevLogin } from './_lib/auth.js'

// Mailtyper der må sendes uden login. ny_booking sendes fra den offentlige
// bookingside og går altid til ejeren (ownerEmail), aldrig til en adresse fra requesten.
const OFFENTLIGE_TYPER = new Set(['ny_booking'])

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { type, mægler } = req.body || {}

  if (!OFFENTLIGE_TYPER.has(type)) {
    const user = await kraevLogin(req, res)
    if (!user) return
  }

  const KEY = process.env.RESEND_API_KEY
  const FROM = `Vania <${process.env.RESEND_FROM || 'dennis@vaniagraphics.dk'}>`
  const APP_URL = process.env.VITE_APP_URL || 'https://app.vaniagraphics.dk'
  const OWNER = process.env.RESEND_FROM || 'dennis@vaniagraphics.dk'

  const emails = byggMails(mægler || {}, { appUrl: APP_URL, ownerEmail: OWNER })
  const emailData = emails[type]
  if (!emailData || !emailData.to) return res.status(400).json({ error: 'Ukendt mailtype eller mangler modtager' })

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, ...emailData })
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      console.error(`Resend fejl (${type}):`, r.status, data)
      return res.status(502).json({ error: data.message || `Resend svarede ${r.status}` })
    }
    res.status(200).json({ success: true, id: data.id })
  } catch (e) {
    console.error(`Mail fejl (${type}):`, e)
    res.status(500).json({ error: e.message })
  }
}
