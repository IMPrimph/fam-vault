import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

/**
 * Self-service profile edit, routed through the update_my_profile RPC.
 *
 * The RPC shipped in the very first migration but nothing ever called it, so
 * a non-admin who was added to the tree with a misspelled name had no way to
 * correct it — the members UPDATE policy is admin-only by design, and this
 * SECURITY DEFINER function is the sanctioned escape hatch.
 */
export function useProfile() {
  const queryClient = useQueryClient()
  const { member, fetchMember } = useAuth()

  const mutation = useMutation({
    mutationFn: async ({ name }) => {
      const { data, error } = await supabase.rpc('update_my_profile', {
        new_name: name.trim(),
        // The RPC assigns avatar_url unconditionally, so echo the current
        // value back or saving a name would blank out the avatar.
        new_avatar_url: member?.avatar_url ?? null,
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
    },
    onSuccess: async () => {
      // Refresh the cached auth member so the sidebar/header update immediately.
      await fetchMember()
      queryClient.invalidateQueries({ queryKey: ['members'] })
      queryClient.invalidateQueries({ queryKey: ['allDocuments'] })
    },
  })

  return { updateProfile: mutation.mutateAsync, saving: mutation.isPending }
}
