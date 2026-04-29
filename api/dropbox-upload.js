export const config = {
  runtime: 'edge',
}

export default async function handler(req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Dropbox-API-Arg, Action',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers })
  }

  const DBX_TOKEN = process.env.DROPBOX_TOKEN
  const action = req.headers.get('action') || 'upload'
  const apiArg = req.headers.get('dropbox-api-arg')

  try {
    if (action === 'get_token') {
      return new Response(JSON.stringify({ token: DBX_TOKEN }), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'link' || action === 'delete') {
      const body = await req.text()
      const url = action === 'link'
        ? 'https://api.dropboxapi.com/2/files/get_temporary_link'
        : 'https://api.dropboxapi.com/2/files/delete_v2'
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${DBX_TOKEN}`, 'Content-Type': 'application/json' },
        body
      })
      const data = await r.text()
      return new Response(data, { status: r.status, headers: { ...headers, 'Content-Type': 'application/json' } })
    }

    // Upload - stream direkte til Dropbox
    const uploadUrl = action === 'start'
      ? 'https://content.dropboxapi.com/2/files/upload_session/start'
      : action === 'append'
        ? 'https://content.dropboxapi.com/2/files/upload_session/append_v2'
        : action === 'finish'
          ? 'https://content.dropboxapi.com/2/files/upload_session/finish'
          : 'https://content.dropboxapi.com/2/files/upload'

    const r = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DBX_TOKEN}`,
        'Dropbox-API-Arg': apiArg || '{}',
        'Content-Type': 'application/octet-stream',
      },
      body: req.body,
      duplex: 'half'
    })

    const data = await r.text()
    return new Response(data, {
      status: r.status,
      headers: { ...headers, 'Content-Type': 'application/json' }
    })

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' }
    })
  }
}
