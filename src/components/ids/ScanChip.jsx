import { formatIdNumber } from '../../lib/idTypes'
import { CheckIcon, ScanIcon } from './icons'

/**
 * Inline status for a number scan: reading → found / nothing / failed.
 *
 * A found number is only ever a suggestion; `onUse` is the explicit tap that
 * puts it into the field. `currentValue` is the number already in the field
 * (normalized), so we can say whether the scan agrees with it.
 */
export default function ScanChip({ status, error, candidates, type, currentValue, onUse }) {
  if (status === 'idle') return null

  if (status === 'scanning') {
    return (
      <div className="flex items-center gap-2 text-sm text-text-secondary bg-surface-muted rounded-xl px-3 py-2.5" role="status">
        <span className="w-4 h-4 rounded-full border-2 border-primary-500 border-t-transparent animate-spin shrink-0" />
        Reading number…
      </div>
    )
  }

  if (status === 'error') {
    return <p className="text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2.5" role="status">{error}</p>
  }

  if (!candidates.length) {
    return (
      <p className="flex items-center gap-2 text-sm text-text-muted bg-surface-muted rounded-xl px-3 py-2.5" role="status">
        <ScanIcon className="w-4 h-4 shrink-0" />
        No number found. Type it in.
      </p>
    )
  }

  return (
    <div className="space-y-1.5" role="status">
      {candidates.slice(0, 2).map(c => {
        const shown = formatIdNumber(type, c)
        const matches = currentValue === c
        const differs = !!currentValue && !matches
        return (
          <div key={c} className="flex items-center gap-2 bg-primary-50 rounded-xl pl-3 pr-1.5 py-1.5">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-text-muted">{differs ? "Found, doesn't match what's entered" : 'Found on the file'}</p>
              <p className="font-mono tabular-nums text-[15px] text-text-primary truncate">{shown}</p>
            </div>
            {matches ? (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 px-3 py-2">
                <CheckIcon /> Matches
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onUse(c)}
                className="shrink-0 min-h-10 px-4 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 active:scale-[0.98] transition-colors"
              >
                {differs ? 'Replace' : 'Use this'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
