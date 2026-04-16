import { get, set, del } from 'idb-keyval'

export const QUERY_CACHE_KEY = 'fam-vault-query-cache'

export function createIDBPersister() {
  return {
    persistClient: async (client) => {
      await set(QUERY_CACHE_KEY, client)
    },
    restoreClient: async () => {
      return await get(QUERY_CACHE_KEY)
    },
    removeClient: async () => {
      await del(QUERY_CACHE_KEY)
    },
  }
}

export async function clearQueryCache() {
  await del(QUERY_CACHE_KEY)
}
