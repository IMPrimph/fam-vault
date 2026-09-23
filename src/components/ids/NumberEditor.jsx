import { useState } from 'react'
import { ID_TYPES, normalizeIdNumber, formatIdNumber, validateIdNumber } from '../../lib/idTypes'
import { extractCandidates } from '../../lib/extractIds'
import { isScannable } from '../../lib/idRecords'
import { useNumberScan } from '../../hooks/useNumberScan'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import ScanChip from './ScanChip'
import { ScanIcon } from './icons'

/**
 * Edit one ID number in place, with an optional "Read from image" that scans
 * the record's own files (newest first) and offers what it finds.
 */
export default function NumberEditor({ type, categoryName, initialValue, docs = [], onSave, onCancel }) {
  const online = useOnlineStatus()
  const [value, setValue] = useState(formatIdNumber(type, initialValue))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const scan = useNumberScan()

  const normalized = normalizeIdNumber(type, value)
  const warning = validateIdNumber(type, normalized)
  const candidates = scan.status === 'done' ? extractCandidates(scan.text, type) : []
  const scannable = type !== 'other' ? docs.filter(isScannable) : []
  const meta = ID_TYPES[type]

  async function readFromFiles() {
    const newestFirst = [...scannable].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    for (const doc of newestFirst) {
      const text = await scan.scanDocument(doc, type)
      if (extractCandidates(text, type).length) return
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave(normalized)
    } catch (err) {
      setError(err.message || 'Could not save the number')
      setSaving(false)
    }
  }

  const numeric = type === 'aadhaar'

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="id-number" className="block text-sm font-medium text-text-primary mb-1.5">
          {categoryName} number
        </label>
        <input
          id="id-number"
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={meta.placeholder}
          inputMode={numeric ? 'numeric' : 'text'}
          autoCapitalize={type === 'other' ? 'off' : 'characters'}
          autoComplete="off"
          spellCheck={false}
          className="w-full px-3.5 py-3 bg-surface border border-stone-300 rounded-xl text-lg font-mono tabular-nums tracking-wide text-text-primary placeholder:text-text-muted placeholder:font-sans placeholder:text-base placeholder:tracking-normal focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all"
        />
        {warning ? (
          <p className="text-xs text-amber-700 mt-1.5">{warning}. You can still save it.</p>
        ) : meta.hint ? (
          <p className="text-xs text-text-muted mt-1.5">{meta.hint}</p>
        ) : null}
      </div>

      {scannable.length > 0 && scan.status !== 'scanning' && (
        <button
          type="button"
          onClick={readFromFiles}
          className="inline-flex items-center gap-1.5 min-h-10 px-3 rounded-lg text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors"
        >
          <ScanIcon /> Read from {scannable.length === 1 ? 'the file' : 'the files'}
        </button>
      )}
      <ScanChip
        status={scan.status}
        error={scan.error}
        candidates={candidates}
        type={type}
        currentValue={normalized}
        onUse={c => setValue(formatIdNumber(type, c))}
      />

      {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <div className="flex items-center justify-end gap-2 pt-1">
        {!online && <p className="text-xs text-text-muted mr-auto">Needs internet to save</p>}
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 px-4 rounded-xl text-sm font-medium text-text-secondary bg-surface border border-stone-300 hover:bg-surface-hover transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !online || normalized === (initialValue || '')}
          className="min-h-11 px-5 rounded-xl text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors active:scale-[0.98]"
        >
          {saving ? 'Saving…' : normalized ? 'Save number' : 'Remove number'}
        </button>
      </div>
    </form>
  )
}
