import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { generateThumbnail, getThumbPath } from '../lib/thumbnails'
import { purgeDocumentBlobs } from '../lib/documentBlobs'

/**
 * Swap a document's image for a corrected (rotated / cropped) version.
 *
 * The bucket has no UPDATE policy and DELETE is admin-only, so we can't
 * overwrite the object at its existing path. Instead the new image goes to a
 * fresh path and `replace_document_file` repoints the row and reaps the old
 * blobs under SECURITY DEFINER — which also keeps a member able to fix their
 * own upload without handing them bucket-wide delete rights.
 */
export function useReplaceDocumentFile() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async ({ doc, blob, familyId }) => {
      const ext = blob.type === 'image/png' ? 'png' : 'jpg'
      const newPath = `${familyId}/${doc.member_id}/${crypto.randomUUID()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(newPath, blob, { contentType: blob.type })
      if (uploadError) throw uploadError

      // Best-effort: a missing thumbnail degrades to a full-res preview.
      try {
        const thumbBlob = await generateThumbnail(blob)
        await supabase.storage
          .from('documents')
          .upload(getThumbPath(newPath), thumbBlob, { contentType: 'image/jpeg' })
      } catch {
        // ignored — the card falls back to the full image
      }

      const { data, error } = await supabase.rpc('replace_document_file', {
        doc_id: doc.id,
        new_file_url: newPath,
        new_file_size: blob.size,
      })

      if (error || data?.error) {
        // The swap failed, so the freshly uploaded blobs are orphans. Try to
        // clear them rather than silently consuming quota.
        await supabase.storage
          .from('documents')
          .remove([newPath, getThumbPath(newPath)])
          .catch(() => {})
        throw new Error(data?.error || error.message)
      }

      // The row already points at the new file; reaping the old blobs is
      // cleanup and must not fail the save.
      await purgeDocumentBlobs(data?.paths)

      return { ...doc, file_url: newPath, file_size: blob.size }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allDocuments'] })
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['storageUsage'] })
    },
  })

  return { replaceFile: mutation.mutateAsync, saving: mutation.isPending }
}
