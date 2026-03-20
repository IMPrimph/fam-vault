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
    await supabase.storage.from('documents').remove([doc.file_url])
    await supabase.from('documents').delete().eq('id', doc.id)
    await fetchAll()
  }

  return { documents, loading, getSignedUrl, deleteDocument, refetch: fetchAll }
}
