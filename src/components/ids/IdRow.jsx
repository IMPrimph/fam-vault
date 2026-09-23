import { formatIdNumber, copyValue } from '../../lib/idTypes'
import CopyButton from './CopyButton'
import { ChevronRightIcon, PlusIcon } from './icons'

/**
 * One ID on a person card: `Aadhaar   1234 5678 9012   [copy]`.
 *
 * Three tap zones: the name side opens the ID sheet, the number itself
 * copies, and the icon copies. With no number yet, the right side offers to
 * add one (if allowed) instead.
 */
export default function IdRow({ record, memberName, personLabel, canEdit, onOpen, onAddNumber }) {
  const fileCount = record.docs.length
  const shown = formatIdNumber(record.type, record.idNumber)
  const toastLabel = `${memberName}'s ${record.categoryName}`

  return (
    <div className="flex items-center gap-1 pl-4 pr-1.5 min-h-14">
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 min-w-0 flex items-center gap-1 py-2 text-left group"
        aria-label={`Open ${toastLabel}`}
      >
        <span className="min-w-0">
          {personLabel && <span className="block text-xs text-text-muted truncate">{personLabel}</span>}
          <span className="block text-sm font-medium text-text-secondary truncate group-hover:text-text-primary">
            {record.categoryName}
          </span>
          {!shown && (
            <span className="block text-xs text-text-muted">
              {fileCount ? `${fileCount} ${fileCount === 1 ? 'file' : 'files'}` : 'No files'}
            </span>
          )}
        </span>
        <ChevronRightIcon className="w-3.5 h-3.5 text-text-muted shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>

      {shown ? (
        <>
          <CopyButton variant="number" value={copyValue(record.type, record.idNumber)} display={shown} toastLabel={toastLabel} className="truncate max-w-[55%]" />
          <CopyButton value={copyValue(record.type, record.idNumber)} toastLabel={toastLabel} />
        </>
      ) : canEdit && record.categoryId && record.type !== 'other' ? (
        <button
          type="button"
          onClick={onAddNumber}
          className="shrink-0 inline-flex items-center gap-1 min-h-11 px-3 rounded-xl text-sm font-medium text-primary-600 hover:bg-primary-50 transition-colors"
        >
          <PlusIcon className="w-3.5 h-3.5" /> Add number
        </button>
      ) : (
        <button type="button" onClick={onOpen} aria-label={`Open ${toastLabel}`} className="shrink-0 w-11 h-11 inline-flex items-center justify-center text-text-muted">
          <ChevronRightIcon />
        </button>
      )}
    </div>
  )
}
