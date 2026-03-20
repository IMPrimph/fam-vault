import { supabase } from '../lib/supabase'
import { useState, useEffect } from 'react'

export function useInvites(familyId) {
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!familyId) return
    fetchInvites()
  }, [familyId])

  async function fetchInvites() {
    setLoading(true)
    const { data, error } = await supabase
      .from('invites')
      .select('*, members(name, relationship)')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false })
    if (!error) setInvites(data || [])
    setLoading(false)
  }

  async function createInvite(memberId) {
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
    await fetchInvites()
    return data
  }

  async function revokeInvite(id) {
    const { error } = await supabase
      .from('invites')
      .update({ status: 'revoked' })
      .eq('id', id)
    if (error) throw error
    await fetchInvites()
  }

  return { invites, loading, createInvite, revokeInvite, refetch: fetchInvites }
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
