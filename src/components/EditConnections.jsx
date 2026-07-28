import { useState } from 'react'
import Modal from './Modal'

export default function EditConnections({ member, members, onSubmit, onClose }) {
  const [parentId, setParentId] = useState(member.parent_member_id || '')
  const [spouseId, setSpouseId] = useState(member.spouse_member_id || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const parentOptions = members.filter(m => m.id !== member.id)
  const spouseOptions = members.filter(m => m.id !== member.id)
  const currentSpouseName = member.spouse_member_id
    ? members.find(m => m.id === member.spouse_member_id)?.name
    : null

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSubmit(member.id, {
        parent_member_id: parentId || null,
        spouse_member_id: spouseId || null,
      })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Edit Connections" description={member.name} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Parent</label>
            <select
              value={parentId}
              onChange={e => setParentId(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface border border-stone-300 rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all"
            >
              <option value="">None</option>
              {parentOptions.map(m => (
                <option key={m.id} value={m.id}>{m.name}{m.relationship ? ` (${m.relationship})` : ''}</option>
              ))}
            </select>
            <p className="text-[11px] text-text-muted mt-1.5">Pick one parent — if that parent has a spouse recorded, we'll draw both as co-parents automatically.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Spouse</label>
            <select
              value={spouseId}
              onChange={e => setSpouseId(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface border border-stone-300 rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all"
            >
              <option value="">None</option>
              {spouseOptions.map(m => (
                <option key={m.id} value={m.id}>{m.name}{m.relationship ? ` (${m.relationship})` : ''}</option>
              ))}
            </select>
            {currentSpouseName && spouseId && spouseId !== member.spouse_member_id && (
              <p className="text-[11px] text-amber-600 mt-1.5">Replacing current spouse ({currentSpouseName}) — the previous link will be cleared on both sides.</p>
            )}
          </div>

          {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl text-sm font-semibold hover:from-primary-700 hover:to-primary-800 disabled:opacity-50 transition-all shadow-md shadow-primary-200 active:scale-[0.98]"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
      </form>
    </Modal>
  )
}
