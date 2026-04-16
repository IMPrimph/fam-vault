import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { queryClient } from './lib/queryClient'
import { createIDBPersister } from './lib/idbPersister'
import { supabase } from './lib/supabase'
import { wipeOfflineData } from './lib/offlineSync'
import './index.css'
import App from './App'

const MEMBER_CACHE_KEY = 'fv:member'

// Shared-device guard: if the currently authenticated user differs from the
// user whose data was last cached locally, purge IDB (blobs, query cache,
// encryption key) before React Query rehydrates. Runs at module load, before
// any tree renders, so the persister can't restore another user's cache.
async function guardCrossUserResidue() {
  try {
    const { data } = await supabase.auth.getSession()
    const currentUserId = data.session?.user?.id ?? null
    const raw = localStorage.getItem(MEMBER_CACHE_KEY)
    const cachedUserId = raw ? (JSON.parse(raw)?.user_id ?? null) : null
    if (cachedUserId && cachedUserId !== currentUserId) {
      localStorage.removeItem(MEMBER_CACHE_KEY)
      await wipeOfflineData()
    }
  } catch {
    // If the guard itself fails we prefer to proceed than to block the app
    // forever — auth-state changes downstream will still clear stale data.
  }
}

await guardCrossUserResidue()

const persister = createIDBPersister()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 7 * 24 * 60 * 60 * 1000 }}
    >
      <App />
    </PersistQueryClientProvider>
  </StrictMode>
)
