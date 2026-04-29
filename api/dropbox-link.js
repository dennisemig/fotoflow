export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers['authorization']?.replace('Bearer ', '')
  const { path, action } = req.body

  if (!token || !path) return res.status(400).json({ error: 'Missing token or path' })

  try {
    let url, body
    if (action === 'delete') {
      url = 'https://api.dropboxapi.com/2/files/delete_v2'
      body = JSON.stringify({ path })
    } else {
      url = 'https://api.dropboxapi.com/2/files/get_temporary_link'
      body = JSON.stringify({ path })
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body
    })

    const data = await response.json()
    res.status(response.status).json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
