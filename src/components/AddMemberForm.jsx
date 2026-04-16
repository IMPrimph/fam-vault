import { useState } from 'react'

const RELATIONSHIP_SUGGESTIONS = [
  'Father', 'Mother', 'Brother', 'Sister', 'Son', 'Daughter',
  'Grandfather', 'Grandmother', 'Uncle', 'Aunt', 'Cousin', 'Spouse',
]

export default function AddMemberForm({ members, onSubmit, onClose }) {
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [parentMemberId, setParentMemberId] = useState('')
  const [spouseMemberId, setSpouseMemberId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await onSubmit({ name, relationship, parentMemberId, spouseMemberId })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface-card rounded-2xl w-full max-w-md shadow-2xl border border-stone-200/60 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h2 className="text-lg font-semibold text-text-primary">Add Family Member</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-text-muted hover:bg-surface-hover transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Name</label>
            <input
              type="text" required value={name} onChange={e => setName(e.target.value)}
              placeholder="Full name"
              className="w-full px-3.5 py-2.5 bg-surface border border-stone-300 rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Relationship</label>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {RELATIONSHIP_SUGGESTIONS.map(r => (
                <button
                  key={r} type="button" onClick={() => setRelationship(r)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                    relationship === r
                      ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-200'
                      : 'bg-stone-100 text-text-secondary hover:bg-stone-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <input
              type="text" required value={relationship} onChange={e => setRelationship(e.target.value)}
              placeholder="Or type custom relationship"
              className="w-full px-3.5 py-2.5 bg-surface border border-stone-300 rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Parent</label>
              <select
                value={parentMemberId} onChange={e => setParentMemberId(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface border border-stone-300 rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all"
              >
                <option value="">None</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Spouse</label>
              <select
                value={spouseMemberId} onChange={e => setSpouseMemberId(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface border border-stone-300 rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all"
              >
                <option value="">None</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}{m.spouse_member_id ? ' (will replace current link)' : ''}</option>)}
              </select>
            </div>
          </div>
          <p className="text-[11px] text-text-muted -mt-3">
            Pick one parent. If that parent has a spouse recorded, we'll draw both as co-parents automatically.
          </p>

          {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <button
            type="submit" disabled={loading}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl text-sm font-semibold hover:from-primary-700 hover:to-primary-800 disabled:opacity-50 transition-all shadow-md shadow-primary-200 active:scale-[0.98]"
          >
            {loading ? 'Adding...' : 'Add Member'}
          </button>
        </form>
      </div>
    </div>
  )
}
