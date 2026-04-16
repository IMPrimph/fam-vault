import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { getCachedSignedUrl } from '../lib/signedUrlCache'
import { getThumbPath } from '../lib/thumbnails'

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
      await supabase.storage.from('documents').remove([doc.file_url]).catch(() => {})
      await supabase.storage.from('documents').remove([getThumbPath(doc.file_url)]).catch(() => {})

      const { error } = await supabase.from('documents').delete().eq('id', doc.id)
      if (error) throw error
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
