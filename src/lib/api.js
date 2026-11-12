import { supabase } from './supabase'

// fetch til vores egne /api-ruter, med brugerens login (Supabase access token).
export async function apiFetch(path, opts = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = { ...(opts.headers || {}) }
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
  return fetch(path, { ...opts, headers })
}

// Sender en notifikationsmail. Kaster aldrig: returnerer { ok, error } og logger fejl,
// så kalderen selv kan vise en besked i stedet for at fejlen forsvinder.
export async function sendMail(type, mægler) {
  try {
    const r = await apiFetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, mægler })
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok || !d.success) throw new Error(d.error || `HTTP ${r.status}`)
    return { ok: true }
  } catch (e) {
    console.error(`Mail (${type}) kunne ikke sendes:`, e)
    return { ok: false, error: e.message }
  }
}
