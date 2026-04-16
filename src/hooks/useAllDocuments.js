import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { getCachedSignedUrl } from '../lib/signedUrlCache'
import { getThumbPath } from '../lib/thumbnails'
import { removeFromOfflineCache } from '../lib/offlineSync'

async function fetchAllDocuments(familyId) {
  const { data, error } = await supabase
    .from('documents')
    .select('*, categories(name), members!inner(id, name, relationship, avatar_url)')
    .eq('members.family_id', familyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export function useAllDocuments(familyId) {
  const queryClient = useQueryClient()

  const { data: documents = [], isLoading: loading } = useQuery({
    queryKey: ['allDocuments', familyId],
    queryFn: () => fetchAllDocuments(familyId),
    enabled: !!familyId,
  })

  const deleteMutation = useMutation({
    mutationFn: async (doc) => {
      const origResult = await supabase.storage.from('documents').remove([doc.file_url])
      if (origResult.error) console.warn('Storage delete failed (original)', doc.file_url, origResult.error)

      const thumbResult = await supabase.storage.from('documents').remove([getThumbPath(doc.file_url)])
      if (thumbResult.error) console.warn('Storage delete failed (thumb)', getThumbPath(doc.file_url), thumbResult.error)

      const { error } = await supabase.from('documents').delete().eq('id', doc.id)
      if (error) throw error

      await removeFromOfflineCache(doc.file_url).catch(e => console.warn('Offline cache remove failed', e))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allDocuments'] })
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })

  return {
    documents,
    loading,
    getSignedUrl: getCachedSignedUrl,
    deleteDocument: deleteMutation.mutateAsync,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['allDocuments', familyId] }),
  }
}
