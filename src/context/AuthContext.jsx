import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchMember(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchMember(session.user.id)
      else {
        setMember(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchMember(userId) {
    const uid = userId || session?.user?.id
    if (!uid) { setLoading(false); return }
    const { data } = await supabase
      .from('members')
      .select('*, families(name)')
      .eq('user_id', uid)
      .single()
    setMember(data)
    setLoading(false)
  }

  async function signInWithEmail(email, redirectPath) {
    // Preserve the current path (e.g., /invite/abc123) so user comes back to the right page
    const redirectTo = window.location.origin + (redirectPath || window.location.pathname === '/' ? '/dashboard' : window.location.pathname)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo }
    })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setSession(null)
    setMember(null)
  }

  const isAdmin = member?.role === 'admin'

  return (
    <AuthContext.Provider value={{ session, member, loading, isAdmin, signInWithEmail, signOut, fetchMember }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
