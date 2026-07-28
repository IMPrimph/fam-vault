import { useState, useEffect, useCallback } from 'react'
import { getThumbPath, isThumbMissing, markThumbMissing } from '../lib/thumbnails'

/**
 * Resolve the preview image for a document.
 *
 * Prefers the generated `_thumb.jpg` and falls back to the full-resolution
 * file for documents uploaded before thumbnails existed. This logic was
 * duplicated verbatim in three components; keeping one copy means the
 * missing-thumb bookkeeping can't drift between them.
 */
export function useThumbnail(doc, getSignedUrl) {
  const [thumbUrl, setThumbUrl] = useState(null)
  const isImage = doc.file_type?.startsWith('image/')

  useEffect(() => {
    if (!isImage || !getSignedUrl) return
    let cancelled = false
    const thumbPath = getThumbPath(doc.file_url)

    const fetchFull = () => getSignedUrl(doc.file_url)
      .then(url => { if (!cancelled) setThumbUrl(url) })
      .catch(() => {})

    if (isThumbMissing(thumbPath)) {
      fetchFull()
    } else {
      getSignedUrl(thumbPath)
        .then(url => { if (!cancelled) setThumbUrl(url) })
        .catch(() => { if (!cancelled) fetchFull() })
    }

    return () => { cancelled = true }
  }, [doc.file_url, isImage, getSignedUrl])

  // The signed URL can resolve fine yet still 404 at render time when the
  // thumbnail object was never created. Remember it and swap to full-res.
  const handleImageError = useCallback(() => {
    markThumbMissing(getThumbPath(doc.file_url))
    if (!getSignedUrl) return
    getSignedUrl(doc.file_url).then(setThumbUrl).catch(() => setThumbUrl(null))
  }, [doc.file_url, getSignedUrl])

  return { thumbUrl, isImage, handleImageError }
}
