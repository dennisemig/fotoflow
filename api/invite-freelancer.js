export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, navn, freelancer_id } = req.body
  if (!email || !navn) return res.status(400).json({ error: 'Mangler email eller navn' })

  try {
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

    // Kald Supabase Admin API direkte via fetch
    const r = await fetch(`${SUPABASE_URL}/auth/v1/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`
      },
      body: JSON.stringify({
        email,
        data: { full_name: navn, role: 'freelancer', freelancer_id },
        redirect_to: `${process.env.VITE_APP_URL}/auth/callback`
      })
    })

    const data = await r.json()
    console.log('Invite svar:', JSON.stringify(data))

    if (!r.ok) throw new Error(data.message || data.error || 'Invitation fejlede')

    // Opret profil
    await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: data.id,
        email,
        full_name: navn,
        role: 'freelancer'
      })
    })

    return res.status(200).json({ success: true, userId: data.id })
  } catch (e) {
    console.error('Invite fejl:', e)
    return res.status(500).json({ error: e.message })
  }
}
