import { useOnlineStatus } from '../hooks/useOnlineStatus'

export default function OfflineBanner() {
  const online = useOnlineStatus()

  if (online) return null

  return (
    <div className="sticky top-0 z-40 bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium shadow-md" role="alert">
      <span className="inline-flex items-center gap-2">
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 0 1 7.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 0 1 1.06 0Z" /></svg>
        You're offline — connect to the internet to view documents
      </span>
    </div>
  )
}
