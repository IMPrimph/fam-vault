import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatFileSize } from '../utils/format'

export default function StorageWarning({ familyId }) {
  const [totalSize, setTotalSize] = useState(0)

  useEffect(() => {
    if (!familyId) return
    supabase
      .from('documents')
      .select('file_size, members!inner(family_id)')
      .eq('members.family_id', familyId)
      .then(({ data }) => {
        const total = (data || []).reduce((sum, d) => sum + (d.file_size || 0), 0)
        setTotalSize(total)
      })
  }, [familyId])

  const maxBytes = 1024 * 1024 * 1024
  const pct = (totalSize / maxBytes) * 100

  if (pct < 80) return null

  return (
    <div className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${
      pct >= 95
        ? 'bg-red-50 border border-red-200 text-red-700'
        : 'bg-amber-50 border border-amber-200 text-amber-700'
    }`}>
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
      <div>
        <p className="font-medium">Storage: {formatFileSize(totalSize)} / 1 GB ({pct.toFixed(1)}%)</p>
        {pct >= 95 && <p className="text-xs mt-0.5 opacity-80">Uploads are blocked. Delete some documents to free space.</p>}
      </div>
    </div>
  )
}
