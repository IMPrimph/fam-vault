import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { clearSignedUrlCache } from '../lib/signedUrlCache'
import { queryClient } from '../lib/queryClient'
import { syncAllDocs, wipeOfflineData, initLastSynced } from '../lib/offlineSync'
import { isOfflineEnabled } from '../lib/offlinePrefs'

const AuthContext = createContext(null)

const MEMBER_CACHE_KEY = 'fv:member'

function readCachedMember(userId) {
  try {
    const raw = localStorage.getItem(MEMBER_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.user_id === userId ? parsed : null
  } catch { return null }
}

function writeCachedMember(m) {
  try {
    if (m) localStorage.setItem(MEMBER_CACHE_KEY, JSON.stringify(m))
    else localStorage.removeItem(MEMBER_CACHE_KEY)
  } catch { /* quota — non-fatal */ }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const lastUserIdRef = useRef(null)

  const fetchMember = useCallback(async (userIdArg) => {
    const userId = userIdArg || lastUserIdRef.current
    if (!userId) { setLoading(false); return }
    lastUserIdRef.current = userId
    setFetchError(null)

    const cached = readCachedMember(userId)
    if (cached) setMember(cached)

    if (!navigator.onLine) {
      if (cached) { setLoading(false); return }
      setFetchError('offline')
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('members')
      .select('*, families(name)')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      if (cached) { setLoading(false); return }
      setFetchError(error.message)
      setLoading(false)
      return
    }

    setMember(data)
    writeCachedMember(data)
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s)
      if (!s) {
        setMember(null)
        writeCachedMember(null)
        lastUserIdRef.current = null
        setLoading(false)
        return
      }
      // Only re-fetch/resync when the user actually changes. TOKEN_REFRESHED
      // and USER_UPDATED fire hourly and don't need a member refetch, let
      // alone a full offline sync.
      if (s.user.id !== lastUserIdRef.current) {
        // User switched mid-session (previous user never signed out, or
        // a different account signed in). Wipe any residue from the prior
        // user before hydrating state for the new one.
        if (lastUserIdRef.current && lastUserIdRef.current !== s.user.id) {
          setMember(null)
          writeCachedMember(null)
          clearSignedUrlCache()
          queryClient.clear()
          await wipeOfflineData()
        }
        fetchMember(s.user.id)
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
    const pathAfterSignIn = redirectPath ?? (window.location.pathname === '/' ? '/dashboard' : window.location.pathname)
    const redirectTo = window.location.origin + pathAfterSignIn
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo }
    })
    return { error }
  }

  async function signOut() {
    // Wipe local state first so any in-flight sync / render pass sees an
    // empty slate before we drop the session. wipeOfflineData() cancels
    // in-flight sync, clears IDB, and deletes the encryption key.
    writeCachedMember(null)
    lastUserIdRef.current = null
    clearSignedUrlCache()
    queryClient.clear()
    await wipeOfflineData()
    await supabase.auth.signOut()
    setSession(null)
    setMember(null)
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
