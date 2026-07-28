import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { getThumbPath } from '../lib/thumbnails'
import { removeFromOfflineCache } from '../lib/offlineSync'

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
        // Break any existing partnership on the chosen spouse's side so we
        // don't end up with asymmetric pointers (X still thinks Y is their
        // spouse while Y now points at the new member).
        const chosenSpouse = members.find(m => m.id === spouseMemberId)
        if (chosenSpouse?.spouse_member_id && chosenSpouse.spouse_member_id !== data.id) {
          await supabase
            .from('members')
            .update({ spouse_member_id: null })
            .eq('id', chosenSpouse.spouse_member_id)
        }

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
      // If spouse_member_id is being changed, keep both sides in sync and
      // unlink any stale partners so we never end up with asymmetric or
      // triangular spouse pointers.
      if (Object.prototype.hasOwnProperty.call(updates, 'spouse_member_id')) {
        const newSpouseId = updates.spouse_member_id || null
        const self = members.find(m => m.id === id)
        const prevSpouseId = self?.spouse_member_id || null

        // 1. Clear the previous spouse of `self` (if any and different).
        if (prevSpouseId && prevSpouseId !== newSpouseId) {
          await supabase.from('members').update({ spouse_member_id: null }).eq('id', prevSpouseId)
        }
        // 2. Clear any OTHER member currently pointing at the new spouse
        //    (defensive — repairs stale state from older data).
        if (newSpouseId) {
          const currentPartner = members.find(m => m.spouse_member_id === newSpouseId && m.id !== id)
          if (currentPartner) {
            await supabase.from('members').update({ spouse_member_id: null }).eq('id', currentPartner.id)
          }
          // 3. Also clear the new spouse's own previous partner if it isn't `self`.
          const newSpouse = members.find(m => m.id === newSpouseId)
          if (newSpouse?.spouse_member_id && newSpouse.spouse_member_id !== id) {
            await supabase
              .from('members')
              .update({ spouse_member_id: null })
              .eq('id', newSpouse.spouse_member_id)
          }
          // 4. Back-link the new spouse to `self`.
          await supabase.from('members').update({ spouse_member_id: id }).eq('id', newSpouseId)
        }
      }

      const { error } = await supabase.from('members').update(updates).eq('id', id)
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
        // Remove the generated thumbnails alongside the originals. Deleting
        // only file_url left every _thumb.jpg orphaned in the bucket, still
        // counting against the family's 1GB quota with no way to reach it.
        const paths = docs.flatMap(d => [d.file_url, getThumbPath(d.file_url)])
        await supabase.storage.from('documents').remove(paths).catch(() => {})
        await Promise.all(
          docs.map(d => removeFromOfflineCache(d.file_url).catch(() => {}))
        )
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', familyId] })
      queryClient.invalidateQueries({ queryKey: ['allDocuments'] })
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['storageUsage'] })
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
