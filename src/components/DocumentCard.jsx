import { useState } from 'react'
import { formatFileSize, formatDate } from '../utils/format'
import { getAvatarGradient, getInitials } from '../utils/avatar'
import { useThumbnail } from '../hooks/useThumbnail'

function FileBadge({ doc }) {
  const isPdf = doc.file_type === 'application/pdf' || doc.file_url?.toLowerCase().endsWith('.pdf')
  const ext = (doc.file_url?.split('.').pop() || '').toUpperCase().slice(0, 4)
  return (
    <div className="flex flex-col items-center justify-center gap-1.5">
      <div className="w-11 h-14 rounded-md bg-gradient-to-br from-amber-100 to-amber-200 text-amber-700 flex items-center justify-center shadow-sm">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
      </div>
      <span className="text-[11px] font-bold tracking-wider text-amber-700">{isPdf ? 'PDF' : ext || 'FILE'}</span>
    </div>
  )
}

/**
 * A single document tile, shared by the dashboard and the member profile.
 *
 * `showMember` adds the owner's name (needed on the dashboard, redundant on a
 * member's own page). `onEdit` / `onDelete` / `onToggleStar` are omitted by the
 * caller when the current user isn't allowed to perform that action.
 */
export default function DocumentCard({
  doc,
  onPreview,
  onDelete,
  onEdit,
  onToggleStar,
  starred,
  getSignedUrl,
  showMember = false,
}) {
  const [downloading, setDownloading] = useState(false)
  const [dlError, setDlError] = useState(false)
  const { thumbUrl, isImage, handleImageError } = useThumbnail(doc, getSignedUrl)

  const categoryName = doc.categories?.name || 'Uncategorized'
  const memberName = doc.members?.name || ''

  async function handleDownload(e) {
    e.stopPropagation()
    setDownloading(true)
    setDlError(false)
    try {
      const url = await getSignedUrl(doc.file_url)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.label + '.' + doc.file_url.split('.').pop()
      a.click()
    } catch {
      setDlError(true)
      setTimeout(() => setDlError(false), 3000)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="group bg-surface-card rounded-2xl border border-stone-200/60 overflow-hidden hover:shadow-lg hover:shadow-stone-200/50 hover:border-stone-300/60 transition-all duration-200 flex flex-col">
      {/* Preview */}
      <button
        onClick={() => onPreview(doc)}
        aria-label={`Preview ${doc.label}`}
        className="w-full h-32 bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center relative overflow-hidden"
      >
        {isImage && thumbUrl ? (
          <img
            src={thumbUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={handleImageError}
          />
        ) : isImage ? (
          <div className="w-11 h-11 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" /></svg>
          </div>
        ) : (
          <FileBadge doc={doc} />
        )}

        {onToggleStar && (
          <span
            role="button"
            tabIndex={0}
            aria-label={starred ? `Remove star from ${doc.label}` : `Star ${doc.label}`}
            onClick={(e) => { e.stopPropagation(); onToggleStar() }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onToggleStar() } }}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-white/85 backdrop-blur shadow-sm hover:bg-white transition-colors"
          >
            <svg className={`w-4 h-4 ${starred ? 'text-amber-400 fill-amber-400' : 'text-stone-400'}`} fill={starred ? 'currentColor' : 'none'} viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>
          </span>
        )}
      </button>

      {/* Info */}
      <div className="p-3.5 flex-1 flex flex-col">
        <p className="font-semibold text-[15px] text-text-primary leading-snug line-clamp-2">{doc.label}</p>
        {doc.notes && <p className="text-xs text-text-muted line-clamp-1 mt-1">{doc.notes}</p>}

        {showMember && memberName && (
          <div className="flex items-center gap-1.5 mt-2">
            <div className={`w-5 h-5 rounded-md bg-gradient-to-br ${getAvatarGradient(memberName)} flex items-center justify-center text-white shrink-0`}>
              <span className="text-[9px] font-bold">{getInitials(memberName).charAt(0)}</span>
            </div>
            <span className="text-xs text-text-secondary font-medium truncate">{memberName}</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className="text-xs font-medium bg-stone-100 text-text-secondary px-2 py-0.5 rounded-md">{categoryName}</span>
          <span className="text-xs text-text-muted">{formatFileSize(doc.file_size)}</span>
        </div>
        <p className="text-xs text-text-muted mt-1.5">{formatDate(doc.created_at)}</p>

        {/* Actions — sized for comfortable tapping */}
        <div className="flex items-center gap-1.5 mt-3">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 text-sm py-2.5 rounded-lg font-semibold transition-colors ${
              dlError ? 'bg-red-50 text-red-600' : 'bg-primary-50 text-primary-700 hover:bg-primary-100'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            {dlError ? 'Failed' : downloading ? '...' : 'Download'}
          </button>
          {onEdit && (
            <button
              onClick={() => onEdit(doc)}
              className="p-2.5 text-text-muted hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              aria-label={`Edit ${doc.label}`} title="Edit"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(doc)}
              className="p-2.5 text-text-muted hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              aria-label={`Delete ${doc.label}`} title="Delete"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
