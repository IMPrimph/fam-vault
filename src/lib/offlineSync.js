import { supabase } from './supabase'
import { db } from './offlineDB'
import { encryptBlob, decryptBlob, deleteKey } from './encryption'
import { getThumbPath } from './thumbnails'
import { isOfflineEnabled } from './offlinePrefs'
import { clearQueryCache } from './idbPersister'

let status = {
  state: 'idle',
  progress: null,
  error: null,
  lastSyncedAt: null,
  failedCount: 0,
}
const listeners = new Set()

function emit(patch) {
  status = { ...status, ...patch }
  listeners.forEach(l => l(status))
}

export function subscribeSyncStatus(cb) {
  listeners.add(cb)
  cb(status)
  return () => listeners.delete(cb)
}

export function getSyncStatus() { return status }

export async function syncAllDocs(familyId) {
  if (!familyId || status.state === 'syncing' || !navigator.onLine) return
  if (!isOfflineEnabled()) return

  emit({ state: 'syncing', progress: { current: 0, total: 0 }, error: null, failedCount: 0 })

  try {
    const { data: remoteDocs, error } = await supabase
      .from('documents')
      .select('id, file_url, file_type, updated_at, members!inner(family_id)')
      .eq('members.family_id', familyId)
    if (error) throw error

    const localMeta = await db.blob_meta.toArray()
    const localByPath = new Map(localMeta.map(m => [m.filePath, m]))
    const remoteDocIds = new Set(remoteDocs.map(d => d.id))

    const toDownload = []
    for (const doc of remoteDocs) {
      const remoteTs = new Date(doc.updated_at).getTime()
      const localOrig = localByPath.get(doc.file_url)
      if (!localOrig || localOrig.updated_at < remoteTs) {
        toDownload.push({ docId: doc.id, filePath: doc.file_url, mime: doc.file_type, updated_at: remoteTs })
      }
      if (doc.file_type?.startsWith('image/')) {
        const thumbPath = getThumbPath(doc.file_url)
        const localThumb = localByPath.get(thumbPath)
        if (!localThumb || localThumb.updated_at < remoteTs) {
          toDownload.push({ docId: doc.id, filePath: thumbPath, mime: 'image/jpeg', updated_at: remoteTs })
        }
      }
    }

    const toDelete = localMeta.filter(m => !remoteDocIds.has(m.docId))
    for (const m of toDelete) {
      await db.blob_meta.delete(m.filePath)
      await db.blob_data.delete(m.filePath)
    }

    emit({ progress: { current: 0, total: toDownload.length } })

    let current = 0
    let failedCount = 0
    for (const item of toDownload) {
      try {
        await downloadAndCache(item)
      } catch (err) {
        failedCount++
        console.warn('Offline cache failed for', item.filePath, err)
      }
      current++
      emit({ progress: { current, total: toDownload.length }, failedCount })
    }

    const lastSyncedAt = Date.now()
    await db.meta.put({ key: 'lastSyncedAt', value: lastSyncedAt })
    emit({
      state: failedCount > 0 ? 'synced-with-errors' : 'synced',
      progress: null,
      lastSyncedAt,
      failedCount,
    })
  } catch (err) {
    emit({ state: 'error', progress: null, error: err.message })
  }
}

async function downloadAndCache({ docId, filePath, mime, updated_at }) {
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(filePath, 3600)
  if (error) throw error

  const resp = await fetch(data.signedUrl)
  if (!resp.ok) {
    if (resp.status === 404 || resp.status === 400) return
    throw new Error(`Download failed: ${resp.status}`)
  }
  const blob = await resp.blob()
  const { cipher, iv } = await encryptBlob(blob)

  const effectiveMime = mime || blob.type
  await db.transaction('rw', db.blob_meta, db.blob_data, async () => {
    await db.blob_meta.put({
      filePath,
      docId,
      mime: effectiveMime,
      updated_at,
      cached_at: Date.now(),
      bytes: cipher.byteLength,
    })
    await db.blob_data.put({ filePath, cipher, iv })
  })
}

export async function getOfflineBlobUrl(filePath) {
  const meta = await db.blob_meta.get(filePath)
  if (!meta) return null
  const data = await db.blob_data.get(filePath)
  if (!data) return null
  const blob = await decryptBlob(data.cipher, data.iv, meta.mime)
  return URL.createObjectURL(blob)
}

export async function removeFromOfflineCache(filePath) {
  const thumbPath = getThumbPath(filePath)
  await db.transaction('rw', db.blob_meta, db.blob_data, async () => {
    await db.blob_meta.delete(filePath)
    await db.blob_data.delete(filePath)
    await db.blob_meta.delete(thumbPath)
    await db.blob_data.delete(thumbPath)
  })
}

export async function clearOfflineCache() {
  await db.transaction('rw', db.blob_meta, db.blob_data, db.meta, async () => {
    await db.blob_meta.clear()
    await db.blob_data.clear()
    await db.meta.delete('lastSyncedAt')
  })
  await clearQueryCache()
  emit({ state: 'idle', progress: null, lastSyncedAt: null, failedCount: 0 })
}

export async function wipeOfflineData() {
  await clearOfflineCache()
  await deleteKey()
}

export async function getCacheStats() {
  const meta = await db.blob_meta.toArray()
  const totalBytes = meta.reduce((sum, m) => sum + (m.bytes || 0), 0)
  const lastSynced = await db.meta.get('lastSyncedAt')
  const uniqueDocs = new Set(meta.map(m => m.docId)).size
  return {
    docCount: uniqueDocs,
    fileCount: meta.length,
    bytes: totalBytes,
    lastSyncedAt: lastSynced?.value || null,
  }
}

export async function initLastSynced() {
  const entry = await db.meta.get('lastSyncedAt')
  if (entry?.value) emit({ lastSyncedAt: entry.value })
}
