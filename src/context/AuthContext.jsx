import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { clearSignedUrlCache } from '../lib/signedUrlCache'
import { queryClient } from '../lib/queryClient'
import { syncAllDocs, wipeOfflineData, initLastSynced } from '../lib/offlineSync'
import { isOfflineEnabled } from '../lib/offlinePrefs'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)

  const fetchMember = useCallback(async (userId) => {
    if (!userId) { setLoading(false); return }
    setFetchError(null)
    const { data, error } = await supabase
      .from('members')
      .select('*, families(name)')
      .eq('user_id', userId)
      .single()
    if (error && error.code !== 'PGRST116') {
      setFetchError(error.message)
    }
    setMember(data)
    setLoading(false)
    if (data?.family_id) {
      initLastSynced()
      if (isOfflineEnabled()) syncAllDocs(data.family_id)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      if (s) fetchMember(s.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (s) fetchMember(s.user.id)
      else {
        setMember(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchMember])

  useEffect(() => {
    if (!member?.family_id) return
    const onOnline = () => { if (isOfflineEnabled()) syncAllDocs(member.family_id) }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [member?.family_id])

  async function signInWithEmail(email, redirectPath) {
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
    clearSignedUrlCache()
    queryClient.clear()
    await wipeOfflineData()
  }

  const isAdmin = member?.role === 'admin'

  return (
    <AuthContext.Provider value={{ session, member, loading, fetchError, isAdmin, signInWithEmail, signOut, fetchMember }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
