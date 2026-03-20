import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAllDocuments(familyId) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!familyId) return
    fetchAll()
  }, [familyId])

  async function fetchAll() {
    setLoading(true)
    const { data, error } = await supabase
      .from('documents')
      .select('*, categories(name), members!inner(id, name, relationship, avatar_url)')
      .order('created_at', { ascending: false })
    if (!error) setDocuments(data || [])
    setLoading(false)
  }

  async function getSignedUrl(filePath) {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 3600)
    if (error) throw error
    return data.signedUrl
  }

  async function deleteDocument(doc) {
    // Delete DB row first, then storage (best-effort).
    // If DB fails, nothing is lost. If storage fails, we have an orphan (harmless).
    const { error } = await supabase.from('documents').delete().eq('id', doc.id)
    if (error) throw error
    await supabase.storage.from('documents').remove([doc.file_url]).catch(() => {})
    await fetchAll()
  }

  return { documents, loading, getSignedUrl, deleteDocument, refetch: fetchAll }
}
