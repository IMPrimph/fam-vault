import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { getCachedSignedUrl, invalidateCachedUrl } from '../lib/signedUrlCache'
import { generateThumbnail, getThumbPath } from '../lib/thumbnails'
import { removeFromOfflineCache } from '../lib/offlineSync'

async function fetchDocuments(memberId) {
  const { data, error } = await supabase
    .from('documents')
    .select('*, categories(name)')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export function useDocuments(memberId) {
  const queryClient = useQueryClient()

  const { data: documents = [], isLoading: loading } = useQuery({
    queryKey: ['documents', memberId],
    queryFn: () => fetchDocuments(memberId),
    enabled: !!memberId,
  })

  const uploadMutation = useMutation({
    mutationFn: async ({ memberId, categoryId, label, file, notes, familyId }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const fileExt = file.name.split('.').pop()
      const docId = crypto.randomUUID()
      const filePath = `${familyId}/${memberId}/${docId}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, { contentType: file.type })
      if (uploadError) throw uploadError

      if (file.type.startsWith('image/')) {
        try {
          const thumbBlob = await generateThumbnail(file)
          const thumbPath = getThumbPath(filePath)
          await supabase.storage
            .from('documents')
            .upload(thumbPath, thumbBlob, { contentType: 'image/jpeg' })
        } catch {
          // Thumbnail failure is non-critical — full-res fallback works
        }
      }

      const { data, error } = await supabase
        .from('documents')
        .insert({
          member_id: memberId,
          category_id: categoryId,
          label,
          file_url: filePath,
          file_type: file.type,
          file_size: file.size,
          notes: notes || null,
          uploaded_by: user.id,
        })
        .select('*, categories(name)')
        .single()

      if (error) {
        await supabase.storage.from('documents').remove([filePath])
        throw error
      }

      return { doc: data, familyId }
    },
    onSuccess: ({ familyId }) => {
      queryClient.invalidateQueries({ queryKey: ['documents', memberId] })
      queryClient.invalidateQueries({ queryKey: ['allDocuments'] })
      if (familyId) queryClient.invalidateQueries({ queryKey: ['members', familyId] })
      queryClient.invalidateQueries({ queryKey: ['storageUsage'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (doc) => {
      const { data, error } = await supabase.rpc('delete_document', { doc_id: doc.id })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      invalidateCachedUrl(doc.file_url)
      invalidateCachedUrl(getThumbPath(doc.file_url))
      await removeFromOfflineCache(doc.file_url).catch(e => console.warn('Offline cache remove failed', e))
      return doc
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', memberId] })
      queryClient.invalidateQueries({ queryKey: ['allDocuments'] })
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: ['storageUsage'] })
    },
  })

  return {
    documents,
    loading,
    uploadDocument: async (args) => (await uploadMutation.mutateAsync(args)).doc,
    deleteDocument: deleteMutation.mutateAsync,
    getSignedUrl: getCachedSignedUrl,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['documents', memberId] }),
  }
}
