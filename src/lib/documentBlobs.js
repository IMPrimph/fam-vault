import { supabase } from './supabase'
import { invalidateCachedUrl } from './signedUrlCache'
import { removeFromOfflineCache } from './offlineSync'

/**
 * Reap the storage objects a document RPC just orphaned.
 *
 * Supabase rejects direct DML on storage.objects, so the RPCs only touch the
 * documents table and hand back the paths they superseded. Removal has to go
 * through the Storage API under the caller's own credentials.
 *
 * Best-effort by design: the database is already consistent by the time this
 * runs, so a failure here costs quota, not correctness. Surfacing it as an
 * error would tell the user their delete failed when it didn't.
 */
export async function purgeDocumentBlobs(paths) {
  const valid = (paths || []).filter(Boolean)
  if (!valid.length) return

  for (const path of valid) invalidateCachedUrl(path)

  try {
    await supabase.storage.from('documents').remove(valid)
  } catch (err) {
    console.warn('Could not remove stored files', valid, err)
  }

  // Keyed off the original file; removeFromOfflineCache clears its thumb too.
  await removeFromOfflineCache(valid[0]).catch(err =>
    console.warn('Offline cache remove failed', err)
  )
}
