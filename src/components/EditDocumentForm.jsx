import { useState } from 'react'
import Modal from './Modal'
import { useCategories } from '../hooks/useCategories'
import { useEditDocument } from '../hooks/useEditDocument'
import { useToast } from '../context/ToastContext'

export default function EditDocumentForm({ doc, familyId, onClose }) {
  const { categories } = useCategories(familyId)
  const { editDocument, saving } = useEditDocument()
  const toast = useToast()

  const [label, setLabel] = useState(doc.label || '')
  const [categoryId, setCategoryId] = useState(doc.category_id || '')
  const [notes, setNotes] = useState(doc.notes || '')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      await editDocument({ id: doc.id, label: label.trim(), categoryId, notes })
      toast.success('Document updated')
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Modal title="Edit Document" description="Change the name, category or notes." onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
        <div>
          <label htmlFor="edit-label" className="block text-sm font-medium text-text-primary mb-1.5">Name</label>
          <input
            id="edit-label"
            type="text"
            required
            value={label}
            onChange={e => setLabel(e.target.value)}
            className="w-full px-3.5 py-3 bg-surface border border-stone-300 rounded-xl text-base text-text-primary focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all"
          />
        </div>

        <div>
          <label htmlFor="edit-category" className="block text-sm font-medium text-text-primary mb-1.5">Category</label>
          <select
            id="edit-category"
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            className="w-full px-3.5 py-3 bg-surface border border-stone-300 rounded-xl text-base text-text-primary focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all"
          >
            <option value="">Uncategorized</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="edit-notes" className="block text-sm font-medium text-text-primary mb-1.5">
            Notes <span className="text-text-muted font-normal">(optional)</span>
          </label>
          <textarea
            id="edit-notes"
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full px-3.5 py-3 bg-surface border border-stone-300 rounded-xl text-base text-text-primary focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all resize-none"
          />
        </div>

        {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 rounded-xl text-sm font-medium text-text-secondary bg-surface border border-stone-300 hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !label.trim()}
            className="px-5 py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors active:scale-[0.98]"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
