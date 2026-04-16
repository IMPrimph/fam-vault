import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { getCachedSignedUrl } from '../lib/signedUrlCache'
import { generateThumbnail, getThumbPath } from '../lib/thumbnails'

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

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', memberId] })
      queryClient.invalidateQueries({ queryKey: ['allDocuments'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (doc) => {
      // Remove storage first (while the row still exists and RLS context is valid)
      await supabase.storage.from('documents').remove([doc.file_url]).catch(() => {})
      await supabase.storage.from('documents').remove([getThumbPath(doc.file_url)]).catch(() => {})

      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', memberId] })
      queryClient.invalidateQueries({ queryKey: ['allDocuments'] })
    },
  })

  return {
    documents,
    loading,
    uploadDocument: uploadMutation.mutateAsync,
    deleteDocument: deleteMutation.mutateAsync,
    getSignedUrl: getCachedSignedUrl,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['documents', memberId] }),
  }
}
