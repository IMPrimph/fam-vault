import { useState, useRef, useEffect } from 'react'
import { useCategories } from '../hooks/useCategories'
import { useStorageUsage } from '../hooks/useStorageUsage'
import { useNumberScan } from '../hooks/useNumberScan'
import { formatFileSize } from '../utils/format'
import { detectIdType, ID_TYPES, normalizeIdNumber, formatIdNumber, validateIdNumber } from '../lib/idTypes'
import { extractCandidates } from '../lib/extractIds'
import ScanChip from './ids/ScanChip'
import { PlusIcon } from './ids/icons'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const STORAGE_BLOCK_BYTES = 950 * 1024 * 1024
const inputClass = 'w-full px-3.5 py-3 bg-surface border border-stone-300 rounded-xl text-base text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all'

/**
 * Add an ID: pick its type, attach a photo/PDF and/or enter its number.
 *
 * A picked file is scanned on-device right away while the rest of the form
 * is filled in; a found number is offered, never auto-filled. Either a file
 * or a number is enough — a number can be saved before any scan exists.
 *
 * `savedNumbers`: Map of categoryId → stored number for this person, so the
 * field starts from what's already saved and the scan can say if it agrees.
 */
export default function UploadForm({ familyId, presetCategoryId, savedNumbers, onSubmit }) {
  const { categories, addCategory } = useCategories(familyId)
  const { bytes: usedBytes } = useStorageUsage(familyId)
  const storageBlocked = usedBytes >= STORAGE_BLOCK_BYTES
  const scan = useNumberScan()
  const runScan = scan.scan

  const [categoryId, setCategoryId] = useState(presetCategoryId || '')
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [file, setFile] = useState(null)
  const [number, setNumber] = useState('')
  const [numberTouched, setNumberTouched] = useState(false)
  const [label, setLabel] = useState('')
  const [labelTouched, setLabelTouched] = useState(false)
  const [notes, setNotes] = useState('')
  const [showMore, setShowMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef()
  const cameraRef = useRef()
  const scannedRef = useRef(null)

  const categoryName = creatingCategory
    ? newCategory.trim()
    : categories.find(c => c.id === categoryId)?.name || ''
  const type = detectIdType(categoryName)
  const savedNumber = (!creatingCategory && categoryId && savedNumbers?.get(categoryId)) || ''
  const normalized = normalizeIdNumber(type, number)
  const warning = validateIdNumber(type, normalized)
  const candidates = scan.status === 'done' ? extractCandidates(scan.text, type) : []
  const effectiveLabel = labelTouched ? label : (categoryName || file?.name.replace(/\.[^.]+$/, '') || '')
  const numberChanged = normalized !== savedNumber

  // Start from the saved number when a type is chosen, unless the user has
  // already typed or accepted one.
  const shownNumber = numberTouched ? number : formatIdNumber(type, savedNumber)

  // Scan each picked file once, as soon as we know which ID type to look for.
  // Switching type later re-reads the same text; no second OCR pass.
  useEffect(() => {
    if (!file || type === 'other' || scannedRef.current === file) return
    scannedRef.current = file
    runScan(file, type)
  }, [file, type, runScan])

  function pickFile(f) {
    if (!f) return
    if (f.size > MAX_FILE_SIZE) return setError(`File too large (${formatFileSize(f.size)}). Max is 5MB.`)
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(f.type)) return setError('Only JPG, PNG and PDF files are supported.')
    setError('')
    setFile(f)
  }

  function chooseCategory(id) {
    setCategoryId(id)
    setCreatingCategory(false)
    setNewCategory('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (storageBlocked && file) return setError('Storage limit reached.')
    const finalNumber = numberTouched ? normalized : savedNumber
    if (!file && !(numberTouched && numberChanged)) return setError('Attach a file or enter a number.')
    setLoading(true)
    setError('')
    try {
      let catId = categoryId
      if (creatingCategory) {
        if (!newCategory.trim()) throw new Error('Name the new ID type')
        const existing = categories.find(c => c.name.toLowerCase() === newCategory.trim().toLowerCase())
        catId = existing ? existing.id : (await addCategory(newCategory.trim())).id
      }
      if (!catId) throw new Error('Choose what kind of ID this is')
      await onSubmit({
        categoryId: catId,
        file,
        label: effectiveLabel || 'Document',
        notes,
        idNumber: numberTouched && numberChanged ? finalNumber : undefined,
      })
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const submitLabel = loading
    ? 'Saving…'
    : file ? 'Save' : 'Save number'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 1. What kind of ID */}
      <fieldset>
        <legend className="block text-sm font-semibold text-text-primary mb-2">What is it?</legend>
        <div className="flex flex-wrap gap-2">
          {categories.map(c => {
            const active = !creatingCategory && categoryId === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => chooseCategory(c.id)}
                aria-pressed={active}
                className={`min-h-11 px-4 rounded-xl text-sm font-medium transition-all ${
                  active ? 'bg-primary-600 text-white shadow-sm' : 'bg-surface border border-stone-300 text-text-secondary hover:bg-surface-hover'
                }`}
              >
                {c.name}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => { setCreatingCategory(true); setCategoryId('') }}
            aria-pressed={creatingCategory}
            className={`inline-flex items-center gap-1 min-h-11 px-4 rounded-xl text-sm font-medium transition-all ${
              creatingCategory ? 'bg-primary-600 text-white' : 'border border-dashed border-stone-300 text-text-muted hover:text-text-secondary'
            }`}
          >
            <PlusIcon className="w-3.5 h-3.5" /> New type
          </button>
        </div>
        {creatingCategory && (
          <input
            autoFocus
            type="text"
            value={newCategory}
            onChange={e => setNewCategory(e.target.value)}
            placeholder="e.g. Ration Card, Insurance"
            aria-label="New ID type name"
            className={`${inputClass} mt-2`}
          />
        )}
      </fieldset>

      {/* 2. The file */}
      <div>
        <p className="block text-sm font-semibold text-text-primary mb-2">
          Photo or PDF {savedNumber || numberTouched ? <span className="font-normal text-text-muted">(optional)</span> : null}
        </p>
        {storageBlocked ? (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5">Storage is full. You can still save a number; delete old files to upload new ones.</p>
        ) : (
          <>
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click() } }}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]) }}
              className={`border-2 border-dashed rounded-xl px-4 py-6 text-center cursor-pointer transition-all ${
                dragging ? 'border-primary-400 bg-primary-50' : file ? 'border-emerald-300 bg-emerald-50' : 'border-stone-300 hover:border-primary-300'
              }`}
            >
              {file ? (
                <div>
                  <p className="text-sm font-medium text-text-primary break-all">{file.name}</p>
                  <p className="text-xs text-text-muted mt-0.5">{formatFileSize(file.size)} · tap to change</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-text-secondary font-medium">Choose a file<span className="hidden md:inline"> or drop it here</span></p>
                  <p className="text-xs text-text-muted mt-1">JPG, PNG or PDF up to 5MB</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={e => pickFile(e.target.files?.[0])} className="hidden" />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={e => pickFile(e.target.files?.[0])} className="hidden" />
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="md:hidden mt-2 w-full min-h-11 rounded-xl text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors"
            >
              Take a photo
            </button>
          </>
        )}
      </div>

      {/* 3. The number */}
      {(categoryName || creatingCategory) && (
        <div className="space-y-2">
          <label htmlFor="upload-number" className="block text-sm font-semibold text-text-primary">
            {categoryName || 'ID'} number <span className="font-normal text-text-muted">(optional)</span>
          </label>
          <input
            id="upload-number"
            value={shownNumber}
            onChange={e => { setNumber(e.target.value); setNumberTouched(true) }}
            placeholder={ID_TYPES[type].placeholder}
            inputMode={type === 'aadhaar' ? 'numeric' : 'text'}
            autoCapitalize={type === 'other' ? 'off' : 'characters'}
            autoComplete="off"
            spellCheck={false}
            className={`${inputClass} font-mono tabular-nums tracking-wide text-lg placeholder:font-sans placeholder:text-base placeholder:tracking-normal`}
          />
          {numberTouched && warning ? (
            <p className="text-xs text-amber-700">{warning}. You can still save it.</p>
          ) : savedNumber && !numberTouched ? (
            <p className="text-xs text-text-muted">Already saved for this person.</p>
          ) : null}
          <ScanChip
            status={scan.status}
            error={scan.error}
            candidates={candidates}
            type={type}
            currentValue={normalizeIdNumber(type, shownNumber)}
            onUse={c => { setNumber(formatIdNumber(type, c)); setNumberTouched(true) }}
          />
        </div>
      )}

      {/* 4. Extras, out of the way */}
      {file && (
        <div>
          <button
            type="button"
            onClick={() => setShowMore(v => !v)}
            aria-expanded={showMore}
            className="text-sm font-medium text-text-secondary hover:text-text-primary min-h-10"
          >
            {showMore ? '− Fewer options' : '+ Name and notes'}
          </button>
          {showMore && (
            <div className="space-y-3 mt-2">
              <div>
                <label htmlFor="upload-label" className="block text-sm font-medium text-text-primary mb-1.5">File name</label>
                <input
                  id="upload-label"
                  type="text"
                  value={effectiveLabel}
                  onChange={e => { setLabel(e.target.value); setLabelTouched(true) }}
                  placeholder="e.g. Aadhaar front"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="upload-notes" className="block text-sm font-medium text-text-primary mb-1.5">Notes</label>
                <textarea id="upload-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={`${inputClass} resize-none`} />
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <button
        type="submit"
        disabled={loading || (!categoryId && !creatingCategory)}
        className="w-full min-h-12 px-4 bg-primary-600 text-white rounded-xl text-base font-semibold hover:bg-primary-700 disabled:opacity-50 transition-all active:scale-[0.98]"
      >
        {submitLabel}
      </button>
    </form>
  )
}
