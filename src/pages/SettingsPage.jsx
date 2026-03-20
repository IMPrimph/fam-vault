import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useFamily } from '../hooks/useFamily'
import { useMembers } from '../hooks/useMembers'
import { useCategories } from '../hooks/useCategories'
import { getAvatarGradient, getInitials } from '../utils/avatar'
import InviteManager from '../components/InviteManager'
import StorageWarning from '../components/StorageWarning'

const TABS = [
  { id: 'general', label: 'General', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955a1.126 1.126 0 0 1 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg> },
  { id: 'categories', label: 'Categories', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" /></svg> },
  { id: 'members', label: 'Members', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg> },
  { id: 'invites', label: 'Invites', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /></svg> },
]

export default function SettingsPage() {
  const { member } = useAuth()
  const familyId = member?.family_id
  const { updateFamilyName } = useFamily()
  const { members, updateMember } = useMembers(familyId)
  const { categories, addCategory, updateCategory, deleteCategory } = useCategories(familyId)

  const [activeTab, setActiveTab] = useState('general')
  const [familyName, setFamilyName] = useState(member?.families?.name || '')
  const [newCat, setNewCat] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSaveName(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateFamilyName(familyId, familyName)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
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
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-text-primary tracking-tight mb-6">Settings</h1>

      <StorageWarning familyId={familyId} />

      {/* Tab bar */}
      <div className="flex gap-1 bg-surface-muted p-1 rounded-xl mb-6 overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-surface-card text-primary-700 shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-surface-card rounded-2xl border border-stone-200/60 p-6">

        {/* General */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-text-primary mb-1">Family Name</h2>
              <p className="text-sm text-text-muted mb-4">This is displayed in the sidebar and shared with all members.</p>
              <form onSubmit={handleSaveName} className="flex gap-2">
                <input
                  type="text" value={familyName} onChange={e => setFamilyName(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 bg-surface border border-stone-300 rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all"
                />
                <button type="submit" disabled={saving}
                  className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors active:scale-[0.98]">
                  {saved ? 'Saved!' : saving ? 'Saving...' : 'Save'}
                </button>
              </form>
            </div>

            <div className="pt-4 border-t border-stone-100">
              <h2 className="text-base font-semibold text-text-primary mb-1">Storage</h2>
              <p className="text-sm text-text-muted">Your family vault uses Supabase Storage (1 GB free).</p>
            </div>
          </div>
        )}

        {/* Categories */}
        {activeTab === 'categories' && (
          <div>
            <div className="mb-4">
              <h2 className="text-base font-semibold text-text-primary mb-1">Document Categories</h2>
              <p className="text-sm text-text-muted">Organize documents by type. All members can see these categories.</p>
            </div>

            <div className="space-y-1 mb-5">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-surface-hover transition-colors group">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-primary-400" />
                    <span className="text-sm text-text-primary font-medium">{cat.name}</span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        const newName = prompt('Rename category:', cat.name)
                        if (newName && newName !== cat.name) updateCategory(cat.id, newName)
                      }}
                      className="px-2.5 py-1 text-xs text-primary-600 hover:bg-primary-50 rounded-lg font-medium transition-colors"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete "${cat.name}"?`)) deleteCategory(cat.id) }}
                      className="px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 rounded-lg font-medium transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {categories.length === 0 && (
                <p className="text-sm text-text-muted text-center py-4">No categories yet.</p>
              )}
            </div>

            <form onSubmit={handleAddCategory} className="flex gap-2">
              <input
                type="text" value={newCat} onChange={e => setNewCat(e.target.value)}
                placeholder="New category name..."
                className="flex-1 px-3.5 py-2.5 bg-surface border border-stone-300 rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all"
              />
              <button type="submit" disabled={!newCat.trim()}
                className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors active:scale-[0.98]">
                Add
              </button>
            </form>
          </div>
        )}

        {/* Members */}
        {activeTab === 'members' && (
          <div>
            <div className="mb-4">
              <h2 className="text-base font-semibold text-text-primary mb-1">Member Roles</h2>
              <p className="text-sm text-text-muted">Admins can manage the family, upload for others, and generate invite links.</p>
            </div>

            <div className="space-y-2">
              {members.map(m => {
                const gradient = getAvatarGradient(m.name)
                const initials = getInitials(m.name)
                return (
                  <div key={m.id} className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-surface-hover transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-xs font-semibold shadow-sm`}>
                        {initials}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary">{m.name}</p>
                        <p className="text-xs text-text-muted">{m.relationship}{m.user_id ? '' : ' · not joined yet'}</p>
                      </div>
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
                )
              })}
            </div>
          </div>
        )}

        {/* Invites */}
        {activeTab === 'invites' && (
          <InviteManager familyId={familyId} members={members} />
        )}

      </div>
    </div>
  )
}
