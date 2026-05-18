import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    async function handleCallback() {
      // Vent på at Supabase behandler token fra URL
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        // Hent profil for at tjekke rolle
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()

        const role = profile?.role || session.user.user_metadata?.role

        if (role === 'freelancer') {
          navigate('/set-password')
        } else {
          navigate('/')
        }
      } else {
        // Token ikke klar endnu – vent lidt og prøv igen
        setTimeout(async () => {
          const { data: { session: s2 } } = await supabase.auth.getSession()
          if (s2?.user) {
            const { data: p } = await supabase.from('profiles').select('role').eq('id', s2.user.id).single()
            const role = p?.role || s2.user.user_metadata?.role
            navigate(role === 'freelancer' ? '/set-password' : '/')
          } else {
            navigate('/login')
          }
        }, 1500)
      }
    }

    handleCallback()
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        <div style={{ color: 'var(--muted)' }}>Logger ind...</div>
      </div>
    </div>
  )
}
