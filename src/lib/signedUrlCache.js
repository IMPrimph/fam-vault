import { supabase } from './supabase'
import { getOfflineBlobUrl } from './offlineSync'
import { markThumbMissing } from './thumbnails'

const TTL_MS = 50 * 60 * 1000
const cache = new Map()
const inflight = new Map()
// filePath → blob: URL. One per path; re-used across renders until cleared.
const blobUrls = new Map()

export async function getCachedSignedUrl(filePath) {
  const existingBlob = blobUrls.get(filePath)
  if (existingBlob) return existingBlob

  try {
    const offlineUrl = await getOfflineBlobUrl(filePath)
    if (offlineUrl) {
      // Another caller may have raced us. Keep the first URL and revoke ours.
      const winner = blobUrls.get(filePath)
      if (winner) {
        URL.revokeObjectURL(offlineUrl)
        return winner
      }
      blobUrls.set(filePath, offlineUrl)
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
      if (filePath.endsWith('_thumb.jpg')) markThumbMissing(filePath)
      throw err
    })

  inflight.set(filePath, promise)
  return promise
}

export function invalidateCachedUrl(filePath) {
  cache.delete(filePath)
  const blob = blobUrls.get(filePath)
  if (blob) {
    URL.revokeObjectURL(blob)
    blobUrls.delete(filePath)
  }
}

export function clearSignedUrlCache() {
  cache.clear()
  inflight.clear()
  for (const url of blobUrls.values()) URL.revokeObjectURL(url)
  blobUrls.clear()
}
