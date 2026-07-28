import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

/**
 * Edit a document's metadata after upload — label, category, notes.
 *
 * The documents_update RLS policy has always permitted this for the uploader
 * and for admins, but no UI ever exercised it: a typo in a label meant
 * deleting the file and re-uploading it. Only metadata is editable; swapping
 * the underlying file would orphan the stored blob and its thumbnail.
 */
export function useEditDocument() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async ({ id, label, categoryId, notes }) => {
      const { error } = await supabase
        .from('documents')
        .update({
          label,
          category_id: categoryId || null,
          notes: notes?.trim() || null,
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allDocuments'] })
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })

  return { editDocument: mutation.mutateAsync, saving: mutation.isPending }
}
