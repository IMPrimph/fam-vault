import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const MAX_BYTES = 1024 * 1024 * 1024

async function fetchUsage(familyId) {
  const { data, error } = await supabase
    .from('documents')
    .select('file_size, members!inner(family_id)')
    .eq('members.family_id', familyId)
  if (error) throw error
  return (data || []).reduce((sum, d) => sum + (d.file_size || 0), 0)
}

export function useStorageUsage(familyId) {
  const { data = 0, isLoading } = useQuery({
    queryKey: ['storageUsage', familyId],
    queryFn: () => fetchUsage(familyId),
    enabled: !!familyId,
    staleTime: 60 * 1000,
  })
  return { bytes: data, maxBytes: MAX_BYTES, pct: (data / MAX_BYTES) * 100, loading: isLoading }
}
