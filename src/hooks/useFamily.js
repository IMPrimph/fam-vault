import { supabase } from '../lib/supabase'

export function useFamily() {
  async function createFamily(familyName, adminName) {
    const { data, error } = await supabase.rpc('create_family_with_admin', {
      family_name: familyName,
      admin_name: adminName,
    })
    if (error) throw error
    if (data?.error) throw new Error(data.error)
    return data
  }

  async function updateFamilyName(familyId, name) {
    const { error } = await supabase
      .from('families')
      .update({ name })
      .eq('id', familyId)
    if (error) throw error
  }

  return { createFamily, updateFamilyName }
}
