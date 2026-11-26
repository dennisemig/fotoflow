// Login-tjek til mail-ruten. Frontend sender Supabase-sessionens access token
// som "Authorization: Bearer <token>" (se src/lib/mail.js).
// Kun administrator (ikke freelancere) må læse og sende mails.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

async function hentBruger(token) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` }
  })
  if (!r.ok) return null
  const user = await r.json().catch(() => null)
  return user?.id ? user : null
}

async function erFreelancer(user, token) {
  if (user.user_metadata?.role === 'freelancer') return true
  try {
    // Med brugerens eget token, så RLS gælder som i appen
    const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=role&id=eq.${encodeURIComponent(user.id)}`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` }
    })
    const rows = r.ok ? await r.json() : []
    return rows?.[0]?.role === 'freelancer'
  } catch {
    return false
  }
}

// Returnerer brugeren, eller sender 401/403 og returnerer null.
export async function kraevAdminLogin(req, res) {
  const m = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i)
  let user = null
  try { if (m) user = await hentBruger(m[1]) } catch (e) { console.error('Login-tjek fejlede:', e) }
  if (!user) {
    res.status(401).json({ error: 'Ikke logget ind – log ind igen og prøv en gang til' })
    return null
  }
  if (await erFreelancer(user, m[1])) {
    res.status(403).json({ error: 'Kun administrator har adgang til mails' })
    return null
  }
  return user
}
