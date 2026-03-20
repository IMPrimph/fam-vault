import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useDocuments(memberId) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!memberId) return
    fetchDocuments()
  }, [memberId])

  async function fetchDocuments() {
    setLoading(true)
    const { data, error } = await supabase
      .from('documents')
      .select('*, categories(name)')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
    if (!error) setDocuments(data || [])
    setLoading(false)
  }

  async function uploadDocument({ memberId, categoryId, label, file, notes, familyId }) {
    const { data: { user } } = await supabase.auth.getUser()
    const fileExt = file.name.split('.').pop()
    const docId = crypto.randomUUID()
    const filePath = `${familyId}/${memberId}/${docId}.${fileExt}`

    // Upload file first
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file, { contentType: file.type })
    if (uploadError) throw uploadError

    // Insert DB row — if this fails, clean up the uploaded file
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
      // Clean up orphaned storage object
      await supabase.storage.from('documents').remove([filePath])
      throw error
    }

    await fetchDocuments()
    return data
  }

  async function deleteDocument(doc) {
    // Delete DB row first, then storage. If DB delete succeeds but storage fails,
    // we have an orphaned file (harmless) rather than a broken UI card.
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', doc.id)
    if (error) throw error

    // Best-effort storage cleanup — don't throw if this fails
    await supabase.storage.from('documents').remove([doc.file_url]).catch(() => {})

    await fetchDocuments()
  }

  async function getSignedUrl(filePath) {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 3600)
    if (error) throw error
    return data.signedUrl
  }

  return { documents, loading, uploadDocument, deleteDocument, getSignedUrl, refetch: fetchDocuments }
}
