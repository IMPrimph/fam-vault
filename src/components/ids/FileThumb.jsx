import { useThumbnail } from '../../hooks/useThumbnail'
import { getCachedSignedUrl } from '../../lib/signedUrlCache'
import { formatDate } from '../../utils/format'
import { DocIcon, PencilIcon, TrashIcon } from './icons'

/** A tappable file tile inside an ID: big enough to recognise front vs back. */
export default function FileThumb({ doc, onOpen, onEdit, onDelete }) {
  const { thumbUrl, isImage, handleImageError } = useThumbnail(doc, getCachedSignedUrl)
  const isPdf = doc.file_type === 'application/pdf'

  return (
    <div className="rounded-xl border border-stone-200/60 overflow-hidden bg-surface-card">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`View ${doc.label}`}
        className="block w-full aspect-[4/3] bg-gradient-to-br from-stone-50 to-stone-100 relative"
      >
        {isImage && thumbUrl ? (
          <img src={thumbUrl} alt="" loading="lazy" onError={handleImageError} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-text-muted">
            <DocIcon className="w-8 h-8" />
            <span className="text-[11px] font-bold tracking-wider">{isPdf ? 'PDF' : 'FILE'}</span>
          </span>
        )}
      </button>
      <div className="flex items-center gap-1 pl-2.5 pr-1 py-1">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-text-primary truncate">{doc.label}</p>
          <p className="text-[11px] text-text-muted">{formatDate(doc.created_at)}</p>
        </div>
        {onEdit && (
          <button type="button" onClick={() => onEdit(doc)} aria-label={`Edit ${doc.label}`} className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-text-muted hover:text-primary-600 hover:bg-primary-50">
            <PencilIcon className="w-3.5 h-3.5" />
          </button>
        )}
        {onDelete && (
          <button type="button" onClick={() => onDelete(doc)} aria-label={`Delete ${doc.label}`} className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-text-muted hover:text-red-600 hover:bg-red-50">
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
