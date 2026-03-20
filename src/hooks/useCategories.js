import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useCategories(familyId) {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!familyId) return
    fetchCategories()
  }, [familyId])

  async function fetchCategories() {
    setLoading(true)
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('family_id', familyId)
      .order('name')
    if (!error) setCategories(data || [])
    setLoading(false)
  }

  async function addCategory(name) {
    const { data, error } = await supabase
      .from('categories')
      .insert({ family_id: familyId, name })
      .select()
      .single()
    if (error) throw error
    await fetchCategories()
    return data
  }

  async function updateCategory(id, name) {
    const { error } = await supabase
      .from('categories')
      .update({ name })
      .eq('id', id)
    if (error) throw error
    await fetchCategories()
  }

  async function deleteCategory(id) {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
    if (error) throw error
    await fetchCategories()
  }

  return { categories, loading, addCategory, updateCategory, deleteCategory, refetch: fetchCategories }
}
