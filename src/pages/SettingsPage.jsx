import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useFamily } from '../hooks/useFamily'
import { useMembers } from '../hooks/useMembers'
import { useCategories } from '../hooks/useCategories'
import InviteManager from '../components/InviteManager'
import StorageWarning from '../components/StorageWarning'

export default function SettingsPage() {
  const { member } = useAuth()
  const familyId = member?.family_id
  const { updateFamilyName } = useFamily()
  const { members, updateMember } = useMembers(familyId)
  const { categories, addCategory, updateCategory, deleteCategory } = useCategories(familyId)

  const [familyName, setFamilyName] = useState(member?.families?.name || '')
  const [newCat, setNewCat] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSaveName(e) {
    e.preventDefault()
    setSaving(true)
    try { await updateFamilyName(familyId, familyName) } finally { setSaving(false) }
  }

  async function handleAddCategory(e) {
    e.preventDefault()
    if (!newCat.trim()) return
    await addCategory(newCat.trim())
    setNewCat('')
  }

  async function handleToggleAdmin(memberId, currentRole) {
    const newRole = currentRole === 'admin' ? 'member' : 'admin'
    if (memberId === member?.id && newRole === 'member') {
      if (!confirm('Remove your own admin access?')) return
    }
    await updateMember(memberId, { role: newRole })
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-text-primary tracking-tight">Settings</h1>

      <StorageWarning familyId={familyId} />

      {/* Family Name */}
      <div className="bg-surface-card rounded-2xl border border-stone-200/60 p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-3">Family Name</h2>
        <form onSubmit={handleSaveName} className="flex gap-2">
          <input
            type="text" value={familyName} onChange={e => setFamilyName(e.target.value)}
            className="flex-1 px-3.5 py-2 bg-surface border border-stone-300 rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all"
          />
          <button type="submit" disabled={saving}
            className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors active:scale-[0.98]">
            Save
          </button>
        </form>
      </div>

      {/* Categories */}
      <div className="bg-surface-card rounded-2xl border border-stone-200/60 p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-3">Document Categories</h2>
        <div className="space-y-1.5 mb-4">
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-surface-hover transition-colors group">
              <span className="text-sm text-text-primary">{cat.name}</span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    const newName = prompt('Rename category:', cat.name)
                    if (newName && newName !== cat.name) updateCategory(cat.id, newName)
                  }}
                  className="px-2 py-1 text-xs text-primary-600 hover:bg-primary-50 rounded-lg font-medium transition-colors"
                >
                  Rename
                </button>
                <button
                  onClick={() => { if (confirm(`Delete "${cat.name}"?`)) deleteCategory(cat.id) }}
                  className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded-lg font-medium transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={handleAddCategory} className="flex gap-2">
          <input
            type="text" value={newCat} onChange={e => setNewCat(e.target.value)}
            placeholder="New category name"
            className="flex-1 px-3.5 py-2 bg-surface border border-stone-300 rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all"
          />
          <button type="submit" className="px-4 py-2 bg-stone-100 text-text-secondary rounded-xl text-sm font-medium hover:bg-stone-200 transition-colors active:scale-[0.98]">
            Add
          </button>
        </form>
      </div>

      {/* Roles */}
      <div className="bg-surface-card rounded-2xl border border-stone-200/60 p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-3">Member Roles</h2>
        <div className="space-y-1.5">
          {members.map(m => (
            <div key={m.id} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-surface-hover transition-colors">
              <div>
                <span className="text-sm font-medium text-text-primary">{m.name}</span>
                <span className="text-xs text-text-muted ml-2">{m.relationship}</span>
              </div>
              <button
                onClick={() => handleToggleAdmin(m.id, m.role)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                  m.role === 'admin'
                    ? 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                    : 'bg-stone-100 text-text-secondary hover:bg-stone-200'
                }`}
              >
                {m.role}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Invites */}
      <div className="bg-surface-card rounded-2xl border border-stone-200/60 p-5">
        <InviteManager familyId={familyId} members={members} />
      </div>
    </div>
  )
}
