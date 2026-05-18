import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, navn, freelancer_id } = req.body
  if (!email || !navn) return res.status(400).json({ error: 'Mangler email eller navn' })

  try {
    // Inviter brugeren via Supabase Auth – sender automatisk en email med link
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.VITE_APP_URL}/freelancer`,
      data: {
        full_name: navn,
        role: 'freelancer',
        freelancer_id
      }
    })

    if (error) throw new Error(error.message)

    // Opret profil for freelanceren
    await supabaseAdmin.from('profiles').upsert({
      id: data.user.id,
      email,
      full_name: navn,
      role: 'freelancer',
    }, { onConflict: 'id' })

    return res.status(200).json({ success: true, userId: data.user.id })
  } catch (e) {
    console.error('Invite fejl:', e)
    return res.status(500).json({ error: e.message })
  }
}
