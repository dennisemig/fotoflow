// Login-tjek til API-ruterne. Frontend sender Supabase-sessionens access token
// som "Authorization: Bearer <token>" (se src/lib/api.js).
import { SUPABASE_URL, ANON_KEY, sbRest, harServiceKey } from './supabase-server.js'

export async function hentBruger(req) {
  const m = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i)
  if (!m) return null
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${m[1]}` }
  })
  if (!r.ok) return null
  const user = await r.json().catch(() => null)
  return user?.id ? user : null
}

async function erFreelancer(user) {
  if (user.user_metadata?.role === 'freelancer') return true
  if (!harServiceKey()) return false
  try {
    const rows = await sbRest(`profiles?select=role&id=eq.${encodeURIComponent(user.id)}`)
    return rows?.[0]?.role === 'freelancer'
  } catch {
    return false
  }
}

// Returnerer brugeren, eller sender 401/403 og returnerer null.
// ejer: true = freelancere må ikke (fx invitere nye brugere).
export async function kraevLogin(req, res, { ejer = false } = {}) {
  let user = null
  try { user = await hentBruger(req) } catch (e) { console.error('Login-tjek fejlede:', e) }
  if (!user) {
    res.status(401).json({ error: 'Ikke logget ind – log ind igen og prøv en gang til' })
    return null
  }
  if (ejer && await erFreelancer(user)) {
    res.status(403).json({ error: 'Kun administrator har adgang' })
    return null
  }
  return user
}
