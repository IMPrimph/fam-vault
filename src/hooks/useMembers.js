import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

async function fetchMembers(familyId) {
  const { data, error } = await supabase
    .from('members')
    .select('*, documents(id)')
    .eq('family_id', familyId)
    .order('created_at')
  if (error) throw error
  return data || []
}

export function useMembers(familyId) {
  const queryClient = useQueryClient()

  const { data: members = [], isLoading: loading } = useQuery({
    queryKey: ['members', familyId],
    queryFn: () => fetchMembers(familyId),
    enabled: !!familyId,
  })

  const addMutation = useMutation({
    mutationFn: async ({ name, relationship, parentMemberId, spouseMemberId }) => {
      const { data: { user } } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('members')
        .insert({
          family_id: familyId,
          name,
          relationship,
          parent_member_id: parentMemberId || null,
          spouse_member_id: spouseMemberId || null,
          created_by: user.id,
        })
        .select()
        .single()

      if (error) throw error

      if (spouseMemberId) {
        const { error: spouseError } = await supabase
          .from('members')
          .update({ spouse_member_id: data.id })
          .eq('id', spouseMemberId)

        if (spouseError) {
          await supabase.from('members').delete().eq('id', data.id)
          throw new Error('Failed to create spouse link: ' + spouseError.message)
        }
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', familyId] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }) => {
      const { error } = await supabase
        .from('members')
        .update(updates)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', familyId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { data: docs } = await supabase
        .from('documents')
        .select('file_url')
        .eq('member_id', id)

      const member = members.find(m => m.id === id)
      if (member?.spouse_member_id) {
        await supabase
          .from('members')
          .update({ spouse_member_id: null })
          .eq('id', member.spouse_member_id)
      }

      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', id)
      if (error) throw error

      if (docs?.length) {
        const paths = docs.map(d => d.file_url)
        await supabase.storage.from('documents').remove(paths).catch(() => {})
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', familyId] })
      queryClient.invalidateQueries({ queryKey: ['allDocuments'] })
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })

  return {
    members,
    loading,
    addMember: addMutation.mutateAsync,
    updateMember: (id, updates) => updateMutation.mutateAsync({ id, updates }),
    deleteMember: deleteMutation.mutateAsync,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['members', familyId] }),
  }
}
