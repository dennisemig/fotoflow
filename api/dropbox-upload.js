export const config = {
  api: {
    bodyParser: false,
    responseLimit: '100mb',
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
    if (action === 'link') {
      const body = await getBody(req)
      const r = await fetch('https://api.dropboxapi.com/2/files/get_temporary_link', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${DBX_TOKEN}`, 'Content-Type': 'application/json' },
        body
      })
      return res.status(r.status).json(await r.json())
    }

    if (action === 'delete') {
      const body = await getBody(req)
      const r = await fetch('https://api.dropboxapi.com/2/files/delete_v2', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${DBX_TOKEN}`, 'Content-Type': 'application/json' },
        body
      })
      return res.status(r.status).json(await r.json())
    }

    if (action === 'start') {
      const r = await fetch('https://content.dropboxapi.com/2/files/upload_session/start', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${DBX_TOKEN}`, 'Dropbox-API-Arg': apiArg, 'Content-Type': 'application/octet-stream' },
        body: await getRawBody(req)
      })
      return res.status(r.status).json(await r.json())
    }

    if (action === 'append') {
      const r = await fetch('https://content.dropboxapi.com/2/files/upload_session/append_v2', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${DBX_TOKEN}`, 'Dropbox-API-Arg': apiArg, 'Content-Type': 'application/octet-stream' },
        body: await getRawBody(req)
      })
      return res.status(r.status).end()
    }

    if (action === 'finish') {
      const r = await fetch('https://content.dropboxapi.com/2/files/upload_session/finish', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${DBX_TOKEN}`, 'Dropbox-API-Arg': apiArg, 'Content-Type': 'application/octet-stream' },
        body: await getRawBody(req)
      })
      return res.status(r.status).json(await r.json())
    }

    // Default: direct upload
    const r = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${DBX_TOKEN}`, 'Dropbox-API-Arg': apiArg, 'Content-Type': 'application/octet-stream' },
      body: await getRawBody(req)
    })
    return res.status(r.status).json(await r.json())

  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}

async function getRawBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks)
}

async function getBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks).toString()
}
