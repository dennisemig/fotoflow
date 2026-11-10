import { byggMails } from './_lib/mails.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { type, mægler } = req.body
  const KEY = process.env.RESEND_API_KEY
  const FROM = `Vania <${process.env.RESEND_FROM || 'dennis@vaniagraphics.dk'}>`
  const APP_URL = process.env.VITE_APP_URL || 'https://app.vaniagraphics.dk'

  const emails = byggMails(mægler || {}, { appUrl: APP_URL, ownerEmail: process.env.RESEND_FROM })
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
