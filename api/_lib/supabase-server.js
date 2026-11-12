// Server-side adgang til Supabase. Bruger service key, så den omgår RLS:
// kald kun herfra efter at have tjekket login eller et gyldigt token.
export const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
export const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

export function harServiceKey() {
  return !!SERVICE_KEY
}

// Kalder Supabase REST (PostgREST) med service key. path fx "sager?select=id&id=eq.1"
export async function sbRest(path, { method = 'GET', body, headers = {} } = {}) {
  if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_KEY mangler i Vercel')
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  })
  const text = await r.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${data?.message || text.slice(0, 200)}`)
  return data
}

// Laver signerede links til filer i storage-bucket'en "sager".
export async function signerFiler(paths, expiresIn) {
  if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_KEY mangler i Vercel')
  if (!paths.length) return {}
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/sager`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn, paths })
  })
  const data = await r.json().catch(() => null)
  if (!r.ok || !Array.isArray(data)) throw new Error(`Storage ${r.status}: ${data?.message || data?.error || 'kunne ikke signere filer'}`)
  const links = {}
  for (const d of data) {
    const rel = d.signedURL || d.signedUrl
    if (rel && !d.error) links[d.path] = `${SUPABASE_URL}/storage/v1${rel.startsWith('/') ? '' : '/'}${rel}`
  }
  return links
}
