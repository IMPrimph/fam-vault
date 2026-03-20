import { useState, useRef, useEffect } from 'react'
import { useCategories } from '../hooks/useCategories'
import { supabase } from '../lib/supabase'
import { formatFileSize } from '../utils/format'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const STORAGE_BLOCK_BYTES = 950 * 1024 * 1024

export default function UploadForm({ familyId, memberId, onUpload }) {
  const { categories, addCategory } = useCategories(familyId)
  const [categoryId, setCategoryId] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [label, setLabel] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [storageBlocked, setStorageBlocked] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    supabase.from('documents').select('file_size').then(({ data }) => {
      const total = (data || []).reduce((sum, d) => sum + (d.file_size || 0), 0)
      if (total >= STORAGE_BLOCK_BYTES) setStorageBlocked(true)
    })
  }, [])

  function validateAndSetFile(f) {
    if (!f) return
    if (f.size > MAX_FILE_SIZE) {
      setError(`File too large (${formatFileSize(f.size)}). Max is 5MB.`)
      return
    }
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(f.type)) {
      setError('Only JPG, PNG, and PDF files are supported.')
      return
    }
    setError('')
    setFile(f)
    if (!label) setLabel(f.name.replace(/\.[^.]+$/, ''))
  }

  function handleFileChange(e) { validateAndSetFile(e.target.files?.[0]) }
  function handleDrop(e) { e.preventDefault(); setDragging(false); validateAndSetFile(e.dataTransfer.files?.[0]) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (storageBlocked) { setError('Storage limit reached.'); return }
    setLoading(true)
    setError('')
    try {
      let catId = categoryId
      if (newCategory.trim()) {
        const cat = await addCategory(newCategory.trim())
        catId = cat.id
      }
      if (!catId) throw new Error('Please select or create a category')
      await onUpload({ memberId, categoryId: catId, label, file, notes, familyId })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (storageBlocked) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
        </div>
        <p className="font-semibold text-red-700">Storage limit reached</p>
        <p className="text-sm text-red-600 mt-1">Delete some documents to free space.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* File drop zone */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-1.5">File</label>
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            dragging ? 'border-primary-400 bg-primary-50' : file ? 'border-emerald-300 bg-emerald-50' : 'border-stone-300 hover:border-primary-300 hover:bg-primary-50/30'
          }`}
        >
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-text-primary">{file.name}</p>
                <p className="text-xs text-text-muted">{formatFileSize(file.size)}</p>
              </div>
            </div>
          ) : (
            <div>
              <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>
              </div>
              <p className="text-sm text-text-secondary font-medium">Click to upload or drag & drop</p>
              <p className="text-xs text-text-muted mt-1">JPG, PNG, or PDF up to 5MB</p>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={handleFileChange} className="hidden" />
        <input id="camera-input" type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
        <button
          type="button"
          onClick={() => document.getElementById('camera-input')?.click()}
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium md:hidden"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" /></svg>
          Take Photo
        </button>
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-1.5">Category</label>
        <select
          value={categoryId} onChange={e => { setCategoryId(e.target.value); setNewCategory('') }}
          className="w-full px-3.5 py-2.5 bg-surface border border-stone-300 rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all"
        >
          <option value="">Select category...</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input
          type="text" value={newCategory} onChange={e => { setNewCategory(e.target.value); setCategoryId('') }}
          placeholder="Or type to create new..."
          className="w-full mt-2 px-3.5 py-2.5 bg-surface border border-stone-300 rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all"
        />
      </div>

      {/* Label */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-1.5">Label</label>
        <input
          type="text" required value={label} onChange={e => setLabel(e.target.value)}
          placeholder="e.g., Aadhaar Front"
          className="w-full px-3.5 py-2.5 bg-surface border border-stone-300 rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-1.5">Notes <span className="text-text-muted font-normal">(optional)</span></label>
        <textarea
          value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full px-3.5 py-2.5 bg-surface border border-stone-300 rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all resize-none"
        />
      </div>

      {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <button
        type="submit" disabled={loading || !file}
        className="w-full py-2.5 px-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl text-sm font-semibold hover:from-primary-700 hover:to-primary-800 disabled:opacity-50 transition-all shadow-md shadow-primary-200 active:scale-[0.98]"
      >
        {loading ? 'Uploading...' : 'Upload Document'}
      </button>
    </form>
  )
}
