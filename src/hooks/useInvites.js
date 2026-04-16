import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

async function fetchInvites(familyId) {
  const { data, error } = await supabase
    .from('invites')
    .select('*, members(name, relationship)')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export function useInvites(familyId) {
  const queryClient = useQueryClient()

  const { data: invites = [], isLoading: loading } = useQuery({
    queryKey: ['invites', familyId],
    queryFn: () => fetchInvites(familyId),
    enabled: !!familyId,
  })

  const createMutation = useMutation({
    mutationFn: async (memberId) => {
      const token = crypto.randomUUID().replace(/-/g, '')
      const { data, error } = await supabase
        .from('invites')
        .insert({
          family_id: familyId,
          member_id: memberId,
          token,
        })
        .select('*, members(name, relationship)')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites', familyId] })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('invites')
        .update({ status: 'revoked' })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites', familyId] })
    },
  })

  return {
    invites,
    loading,
    createInvite: createMutation.mutateAsync,
    revokeInvite: revokeMutation.mutateAsync,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['invites', familyId] }),
  }
}

export async function lookupInvite(token) {
  const { data, error } = await supabase.rpc('lookup_invite', { invite_token: token })
  if (error) throw error
  return data
}

export async function acceptInvite(token) {
  const { data, error } = await supabase.rpc('accept_invite', { invite_token: token })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}
