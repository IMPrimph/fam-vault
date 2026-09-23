import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

async function fetchMemberIds(familyId) {
  const { data, error } = await supabase
    .from('member_ids')
    .select('id, member_id, category_id, id_number, updated_at, members!inner(family_id)')
    .eq('members.family_id', familyId)
  if (error) throw error
  // Drop the join used only for filtering.
  return (data || []).map(r => ({
    id: r.id, member_id: r.member_id, category_id: r.category_id, id_number: r.id_number, updated_at: r.updated_at,
  }))
}

/**
 * ID numbers for the whole family, one row per (member, category).
 *
 * Lives in the persisted query cache like everything else, which is what
 * makes copying a number work offline.
 */
export function useMemberIds(familyId) {
  const queryClient = useQueryClient()

  const { data: memberIds = [], isLoading: loading } = useQuery({
    queryKey: ['memberIds', familyId],
    queryFn: () => fetchMemberIds(familyId),
    enabled: !!familyId,
  })

  const saveMutation = useMutation({
    mutationFn: async ({ memberId, categoryId, idNumber }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('member_ids')
        .upsert(
          { member_id: memberId, category_id: categoryId, id_number: idNumber || null, updated_by: user?.id },
          { onConflict: 'member_id,category_id' }
        )
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memberIds', familyId] })
    },
  })

  return {
    memberIds,
    loading,
    saveNumber: saveMutation.mutateAsync,
    saving: saveMutation.isPending,
  }
}
