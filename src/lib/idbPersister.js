import { get, set, del } from 'idb-keyval'
import { encryptBlob, decryptBlob, getKey } from './encryption'

export const QUERY_CACHE_KEY = 'fam-vault-query-cache'

// The persister wraps the React Query dehydrated state in AES-GCM using the
// same key that guards offline blobs. Without a key yet (first-ever mount
// before the user signs in and sync runs), persistence is a no-op; the next
// mount will pick up where we left off once a key exists.
export function createIDBPersister() {
  return {
    persistClient: async (client) => {
      const key = await getKey()
      if (!key) return
      const json = JSON.stringify(client)
      const blob = new Blob([json], { type: 'application/json' })
      const { cipher, iv } = await encryptBlob(blob)
      await set(QUERY_CACHE_KEY, { cipher, iv, v: 1 })
    },
    restoreClient: async () => {
      const entry = await get(QUERY_CACHE_KEY)
      if (!entry) return undefined
      if (!entry.cipher || !entry.iv) {
        // Legacy plaintext entry from an older build — drop it.
        await del(QUERY_CACHE_KEY)
        return undefined
      }
      try {
        const blob = await decryptBlob(entry.cipher, entry.iv, 'application/json')
        const text = await blob.text()
        return JSON.parse(text)
      } catch {
        // Key rotated / cache from a different user — discard.
        await del(QUERY_CACHE_KEY)
        return undefined
      }
    },
    removeClient: async () => {
      await del(QUERY_CACHE_KEY)
    },
  }
}

export async function clearQueryCache() {
  await del(QUERY_CACHE_KEY)
}
