import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

async function fetchCategories(familyId) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('family_id', familyId)
    .order('name')
  if (error) throw error
  return data || []
}

export function useCategories(familyId) {
  const queryClient = useQueryClient()

  const { data: categories = [], isLoading: loading } = useQuery({
    queryKey: ['categories', familyId],
    queryFn: () => fetchCategories(familyId),
    enabled: !!familyId,
  })

  const addMutation = useMutation({
    mutationFn: async (name) => {
      const { data, error } = await supabase
        .from('categories')
        .insert({ family_id: familyId, name })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', familyId] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }) => {
      const { error } = await supabase
        .from('categories')
        .update({ name })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', familyId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories', familyId] })
    },
  })

  return {
    categories,
    loading,
    addCategory: addMutation.mutateAsync,
    updateCategory: (id, name) => updateMutation.mutateAsync({ id, name }),
    deleteCategory: deleteMutation.mutateAsync,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['categories', familyId] }),
  }
}
