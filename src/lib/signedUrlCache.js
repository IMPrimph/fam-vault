import { supabase } from './supabase'
import { getOfflineBlobUrl } from './offlineSync'

const TTL_MS = 50 * 60 * 1000
const cache = new Map()
const inflight = new Map()
const blobUrls = new Set()

export async function getCachedSignedUrl(filePath) {
  try {
    const offlineUrl = await getOfflineBlobUrl(filePath)
    if (offlineUrl) {
      blobUrls.add(offlineUrl)
      return offlineUrl
    }
  } catch {
    // Decryption or IDB error — fall back to network
  }

  const cached = cache.get(filePath)
  if (cached && Date.now() < cached.expiresAt) return cached.url

  const pending = inflight.get(filePath)
  if (pending) return pending

  const promise = supabase.storage
    .from('documents')
    .createSignedUrl(filePath, 3600)
    .then(({ data, error }) => {
      inflight.delete(filePath)
      if (error) throw error
      cache.set(filePath, { url: data.signedUrl, expiresAt: Date.now() + TTL_MS })
      return data.signedUrl
    })
    .catch(err => {
      inflight.delete(filePath)
      throw err
    })

  inflight.set(filePath, promise)
  return promise
}

export function clearSignedUrlCache() {
  cache.clear()
  inflight.clear()
  for (const url of blobUrls) URL.revokeObjectURL(url)
  blobUrls.clear()
}
