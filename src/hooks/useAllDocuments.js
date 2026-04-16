import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { getCachedSignedUrl, invalidateCachedUrl } from '../lib/signedUrlCache'
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
      const { data, error } = await supabase.rpc('delete_document', { doc_id: doc.id })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      invalidateCachedUrl(doc.file_url)
      invalidateCachedUrl(getThumbPath(doc.file_url))
      await removeFromOfflineCache(doc.file_url).catch(e => console.warn('Offline cache remove failed', e))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allDocuments'] })
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: ['storageUsage'] })
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
