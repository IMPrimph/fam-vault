import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useMembers(familyId) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!familyId) return
    fetchMembers()
  }, [familyId])

  async function fetchMembers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('members')
      .select('*, documents(id)')
      .eq('family_id', familyId)
      .order('created_at')
    if (!error) setMembers(data || [])
    setLoading(false)
  }

  async function addMember({ name, relationship, parentMemberId, spouseMemberId }) {
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

    // If spouse was set, enforce bidirectional link
    if (spouseMemberId) {
      const { error: spouseError } = await supabase
        .from('members')
        .update({ spouse_member_id: data.id })
        .eq('id', spouseMemberId)

      if (spouseError) {
        // Rollback: clear the one-way link we just created
        await supabase
          .from('members')
          .update({ spouse_member_id: null })
          .eq('id', data.id)
        throw new Error('Failed to create spouse link: ' + spouseError.message)
      }
    }

    await fetchMembers()
    return data
  }

  async function updateMember(id, updates) {
    const { error } = await supabase
      .from('members')
      .update(updates)
      .eq('id', id)
    if (error) throw error
    await fetchMembers()
  }

  async function deleteMember(id) {
    // First delete storage files for this member's documents
    const { data: docs } = await supabase
      .from('documents')
      .select('file_url')
      .eq('member_id', id)

    if (docs?.length) {
      const paths = docs.map(d => d.file_url)
      await supabase.storage.from('documents').remove(paths)
    }

    // Clear spouse back-reference
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
    await fetchMembers()
  }

  return { members, loading, addMember, updateMember, deleteMember, refetch: fetchMembers }
}
