import { useSyncStatus } from '../hooks/useSyncStatus'

function formatAgo(ts) {
  if (!ts) return 'never'
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

export default function SyncIndicator({ compact }) {
  const { state, progress, lastSyncedAt, error, failedCount } = useSyncStatus()

  if (state === 'idle' && !lastSyncedAt) return null

  const isSyncing = state === 'syncing'
  const hasPartialFailure = state === 'synced-with-errors'
  const isError = state === 'error'

  let label
  if (isSyncing) {
    label = progress?.total ? `Syncing ${progress.current}/${progress.total}` : 'Syncing…'
  } else if (isError) {
    label = 'Sync failed'
  } else if (hasPartialFailure) {
    label = `Synced — ${failedCount} failed`
  } else {
    label = `Synced ${formatAgo(lastSyncedAt)}`
  }

  const toneClass = isError ? 'text-red-500' : hasPartialFailure ? 'text-amber-600' : 'text-text-muted'

  return (
    <div className={`inline-flex items-center gap-1.5 text-[11px] ${toneClass}`} title={error || label}>
      {isSyncing ? (
        <div className="w-3 h-3 rounded-full border-2 border-primary-400 border-t-transparent animate-spin" />
      ) : isError ? (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>
      ) : hasPartialFailure ? (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
      ) : (
        <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
      )}
      {!compact && <span>{label}</span>}
    </div>
  )
}
