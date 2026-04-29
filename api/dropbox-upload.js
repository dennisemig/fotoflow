export const config = {
  api: {
    bodyParser: false,
    responseLimit: '4.5gb',
    maxDuration: 300,
  },
}

const DBX_TOKEN = process.env.DROPBOX_TOKEN

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Dropbox-API-Arg, Action')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const action = req.headers['action'] || 'upload'
  const apiArg = req.headers['dropbox-api-arg']

  try {
    if (action === 'get_token') {
      return res.status(200).json({ token: DBX_TOKEN })
    }

    if (action === 'link') {
      const chunks = []; for await (const c of req) chunks.push(c)
      const body = Buffer.concat(chunks).toString()
      const r = await fetch('https://api.dropboxapi.com/2/files/get_temporary_link', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${DBX_TOKEN}`, 'Content-Type': 'application/json' },
        body
      })
      return res.status(r.status).json(await r.json())
    }

    if (action === 'delete') {
      const chunks = []; for await (const c of req) chunks.push(c)
      const body = Buffer.concat(chunks).toString()
      const r = await fetch('https://api.dropboxapi.com/2/files/delete_v2', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${DBX_TOKEN}`, 'Content-Type': 'application/json' },
        body
      })
      return res.status(r.status).json(await r.json())
    }

    // Upload actions – stream direkte til Dropbox
    const uploadUrls = {
      upload: 'https://content.dropboxapi.com/2/files/upload',
      start: 'https://content.dropboxapi.com/2/files/upload_session/start',
      append: 'https://content.dropboxapi.com/2/files/upload_session/append_v2',
      finish: 'https://content.dropboxapi.com/2/files/upload_session/finish',
    }

    const url = uploadUrls[action]
    if (!url) return res.status(400).json({ error: 'Unknown action' })

    const chunks = []; for await (const c of req) chunks.push(c)
    const body = Buffer.concat(chunks)

    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DBX_TOKEN}`,
        'Dropbox-API-Arg': apiArg || '{}',
        'Content-Type': 'application/octet-stream',
      },
      body
    })

    const contentType = r.headers.get('content-type') || ''
    if (contentType.includes('json')) {
      return res.status(r.status).json(await r.json())
    }
    return res.status(r.status).end()

  } catch (e) {
    console.error('Dropbox API fejl:', e)
    res.status(500).json({ error: e.message })
  }
}
