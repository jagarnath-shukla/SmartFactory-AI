import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import App from './App'
import Auth from './components/Auth'
import { supabase } from './lib/supabase'

export default function Root() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const loadSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()

        if (error) throw error

        if (mounted) {
          setSession(data.session)
        }
      } catch (error) {
        console.error('Authentication error:', error)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadSession()

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_event, newSession) => {
        if (mounted) setSession(newSession)
      })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        Loading SmartFactory AI...
      </div>
    )
  }

  return session ? (
    <App />
  ) : (
    <Auth
      onAuthenticated={async () => {
        const { data } = await supabase.auth.getSession()
        setSession(data.session)
      }}
    />
  )
}
