const DBX_TOKEN = process.env.DROPBOX_TOKEN

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Dropbox-API-Arg, Action')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const action = req.headers['action']
  const contentType = req.headers['content-type'] || ''

  try {
    // JSON actions – læs body som tekst
    if (!action || action === 'get_token' || action === 'link' || action === 'delete') {
      const chunks = []; for await (const c of req) chunks.push(c)
      const bodyText = Buffer.concat(chunks).toString()

      if (action === 'get_token' || !action) {
        return res.status(200).json({ token: DBX_TOKEN })
      }

      if (action === 'link') {
        const { path } = JSON.parse(bodyText)
        const r = await fetch('https://api.dropboxapi.com/2/files/get_temporary_link', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${DBX_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ path })
        })
        return res.status(r.status).json(await r.json())
      }

      if (action === 'delete') {
        const { path } = JSON.parse(bodyText)
        const r = await fetch('https://api.dropboxapi.com/2/files/delete_v2', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${DBX_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ path })
        })
        return res.status(r.status).json(await r.json())
      }
    }

    res.status(400).json({ error: 'Unknown action' })
  } catch (e) {
    console.error('Dropbox fejl:', e)
    res.status(500).json({ error: e.message })
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
}
