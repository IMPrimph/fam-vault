import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useDialog } from '../context/DialogContext'
import { useFamily } from '../hooks/useFamily'
import { useMembers } from '../hooks/useMembers'
import { useCategories } from '../hooks/useCategories'
import { useProfile } from '../hooks/useProfile'
import { useTheme } from '../hooks/useTheme'
import { useSyncStatus } from '../hooks/useSyncStatus'
import { getAvatarGradient, getInitials } from '../utils/avatar'
import { formatFileSize } from '../utils/format'
import { syncAllDocs, clearOfflineCache, getCacheStats } from '../lib/offlineSync'
import { isOfflineEnabled, setOfflineEnabled } from '../lib/offlinePrefs'
import InviteManager from '../components/InviteManager'
import StorageWarning from '../components/StorageWarning'

const icon = (path) => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
)

/**
 * Tabs are declared with the role that may see them. Settings itself is open
 * to every member: locking the whole page behind an admin guard also hid the
 * offline-cache controls, which is exactly the setting a non-admin on a shared
 * device most needs to reach.
 */
const TABS = [
  { id: 'profile', label: 'Profile', adminOnly: false, icon: icon('M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z') },
  { id: 'general', label: 'Family', adminOnly: true, icon: icon('m2.25 12 8.954-8.955a1.126 1.126 0 0 1 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25') },
  { id: 'categories', label: 'Categories', adminOnly: true, icon: icon('M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z') },
  { id: 'members', label: 'Members', adminOnly: true, icon: icon('M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z') },
  { id: 'invites', label: 'Invites', adminOnly: true, icon: icon('M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244') },
  { id: 'offline', label: 'Offline', adminOnly: false, icon: icon('M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z') },
]

const inputClass = 'w-full px-3.5 py-3 bg-surface border border-stone-300 rounded-xl text-base text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all'

export default function SettingsPage() {
  const { member, session, isAdmin } = useAuth()
  const familyId = member?.family_id
  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin)
  const [activeTab, setActiveTab] = useState('profile')

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-text-primary tracking-tight mb-6">Settings</h1>

      {isAdmin && <StorageWarning familyId={familyId} />}

      <div className="flex gap-1 bg-surface-muted p-1 rounded-xl mb-6 overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id ? 'bg-surface-card text-primary-700 shadow-sm' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-surface-card rounded-2xl border border-stone-200/60 p-6">
        {activeTab === 'profile' && <ProfileSettings member={member} email={session?.user?.email} />}
        {activeTab === 'general' && isAdmin && <FamilySettings familyId={familyId} initialName={member?.families?.name || ''} />}
        {activeTab === 'categories' && isAdmin && <CategorySettings familyId={familyId} />}
        {activeTab === 'members' && isAdmin && <MemberSettings familyId={familyId} currentMemberId={member?.id} />}
        {activeTab === 'invites' && isAdmin && <InviteManager familyId={familyId} />}
        {activeTab === 'offline' && <OfflineSettings familyId={familyId} />}
      </div>
    </div>
  )
}

function ProfileSettings({ member, email }) {
  const { updateProfile, saving } = useProfile()
  const toast = useToast()
  const [name, setName] = useState(member?.name || '')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      await updateProfile({ name })
      toast.success('Your name has been updated')
    } catch (err) {
      toast.error(err.message || 'Could not save your name')
    }
  }

  const dirty = name.trim() !== (member?.name || '')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getAvatarGradient(member?.name)} flex items-center justify-center text-white text-lg font-bold shadow-md shrink-0`}>
          {getInitials(member?.name)}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-text-primary truncate">{member?.name}</p>
          <p className="text-sm text-text-muted truncate">{email}</p>
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold text-text-primary mb-1">Your name</h2>
        <p className="text-sm text-text-muted mb-4">This is how you appear to the rest of the family.</p>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            aria-label="Your name"
            className={inputClass}
          />
          <button
            type="submit"
            disabled={saving || !dirty || !name.trim()}
            className="px-5 py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors active:scale-[0.98] shrink-0"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </form>
      </div>

      <div className="pt-4 border-t border-stone-100">
        <AppearanceSetting />
      </div>

      <div className="pt-4 border-t border-stone-100">
        <p className="text-sm text-text-muted">
          <span className="font-medium text-text-secondary">Your role:</span>{' '}
          {member?.role === 'admin'
            ? 'Admin — you can manage the family, categories and invites.'
            : 'Member — you can view every family document and upload your own.'}
        </p>
        <p className="text-sm text-text-muted mt-2">
          Your relationship ({member?.relationship}) and role are set by a family admin.
        </p>
      </div>
    </div>
  )
}

// Swatches are literal colours rather than theme tokens — each one has to show
// what it looks like while a different theme is active.
const THEME_SWATCH = {
  light: { page: '#fafaf9', card: '#ffffff', ink: '#1c1917', accent: '#4f46e5' },
  warm: { page: '#f4ecdf', card: '#fdf8ef', ink: '#3a2e21', accent: '#4f46e5' },
  dark: { page: '#0c0a09', card: '#1c1917', ink: '#fafaf9', accent: '#818cf8' },
}

function AppearanceSetting() {
  const { theme, themes, setTheme } = useTheme()

  return (
    <div>
      <h2 className="text-base font-semibold text-text-primary mb-1">Appearance</h2>
      <p className="text-sm text-text-muted mb-4">Applies to this device only.</p>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Appearance">
        {themes.map(t => {
          const swatch = THEME_SWATCH[t.id]
          const active = theme === t.id
          return (
            <button
              key={t.id}
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(t.id)}
              className={`rounded-xl border p-2.5 text-left transition-all ${
                active
                  ? 'border-primary-500 ring-2 ring-primary-500/20'
                  : 'border-stone-200 hover:border-stone-300'
              }`}
            >
              <div
                className="h-12 rounded-lg mb-2 flex items-end gap-1 p-1.5 border border-black/5"
                style={{ background: swatch.page }}
              >
                <span className="flex-1 h-full rounded flex items-center px-1" style={{ background: swatch.card }}>
                  <span className="h-1 w-full rounded" style={{ background: swatch.ink, opacity: 0.35 }} />
                </span>
                <span className="w-2.5 h-full rounded" style={{ background: swatch.accent }} />
              </div>
              <p className={`text-sm font-medium ${active ? 'text-primary-700' : 'text-text-primary'}`}>{t.label}</p>
              <p className="text-xs text-text-muted leading-tight">{t.hint}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FamilySettings({ familyId, initialName }) {
  const { updateFamilyName } = useFamily()
  const toast = useToast()
  const [familyName, setFamilyName] = useState(initialName)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateFamilyName(familyId, familyName)
      toast.success('Family name updated')
    } catch (err) {
      toast.error(err.message || 'Could not save the family name')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-text-primary mb-1">Family name</h2>
        <p className="text-sm text-text-muted mb-4">Shown in the sidebar for everyone in the family.</p>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
          <input type="text" value={familyName} onChange={e => setFamilyName(e.target.value)} aria-label="Family name" className={inputClass} />
          <button
            type="submit"
            disabled={saving || !familyName.trim()}
            className="px-5 py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors active:scale-[0.98] shrink-0"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </form>
      </div>
      <div className="pt-4 border-t border-stone-100">
        <h2 className="text-base font-semibold text-text-primary mb-1">Storage</h2>
        <p className="text-sm text-text-muted">Your family vault uses Supabase Storage (1 GB free).</p>
      </div>
    </div>
  )
}

function CategorySettings({ familyId }) {
  const { categories, addCategory, updateCategory, deleteCategory } = useCategories(familyId)
  const { confirm, prompt } = useDialog()
  const toast = useToast()
  const [newCat, setNewCat] = useState('')

  async function handleAdd(e) {
    e.preventDefault()
    if (!newCat.trim()) return
    try {
      await addCategory(newCat.trim())
      toast.success(`Added "${newCat.trim()}"`)
      setNewCat('')
    } catch (err) {
      toast.error(err.message || 'Could not add that category')
    }
  }

  async function handleRename(cat) {
    const newName = await prompt({
      title: 'Rename category',
      label: 'Category name',
      defaultValue: cat.name,
      confirmLabel: 'Rename',
    })
    if (!newName || newName === cat.name) return
    try {
      await updateCategory(cat.id, newName)
      toast.success('Category renamed')
    } catch (err) {
      toast.error(err.message || 'Could not rename the category')
    }
  }

  async function handleDelete(cat) {
    const ok = await confirm({
      title: `Delete "${cat.name}"?`,
      message: 'Documents in this category are kept, but become uncategorized.',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return
    try {
      await deleteCategory(cat.id)
      toast.success(`Deleted "${cat.name}"`)
    } catch (err) {
      toast.error(err.message || 'Could not delete the category')
    }
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-text-primary mb-1">Document categories</h2>
        <p className="text-sm text-text-muted">Types of document, like Aadhaar or Passport. Everyone can file documents under these.</p>
      </div>

      <div className="space-y-1 mb-5">
        {categories.map(cat => (
          <div key={cat.id} className="flex items-center justify-between gap-2 py-2.5 px-3 rounded-xl hover:bg-surface-hover transition-colors">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-2 h-2 rounded-full bg-primary-400 shrink-0" />
              <span className="text-sm text-text-primary font-medium truncate">{cat.name}</span>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => handleRename(cat)} className="px-3 py-1.5 text-xs text-primary-600 hover:bg-primary-50 rounded-lg font-medium transition-colors">
                Rename
              </button>
              <button onClick={() => handleDelete(cat)} className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg font-medium transition-colors">
                Delete
              </button>
            </div>
          </div>
        ))}
        {categories.length === 0 && <p className="text-sm text-text-muted text-center py-4">No categories yet.</p>}
      </div>

      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2">
        <input type="text" value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="New category name..." aria-label="New category name" className={inputClass} />
        <button type="submit" disabled={!newCat.trim()} className="px-5 py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors active:scale-[0.98] shrink-0">
          Add
        </button>
      </form>
    </div>
  )
}

function MemberSettings({ familyId, currentMemberId }) {
  const { members, updateMember } = useMembers(familyId)
  const { confirm } = useDialog()
  const toast = useToast()

  async function handleToggleAdmin(m) {
    const newRole = m.role === 'admin' ? 'member' : 'admin'
    if (m.id === currentMemberId && newRole === 'member') {
      const ok = await confirm({
        title: 'Give up your admin access?',
        message: "You won't be able to manage the family, categories or invites afterwards. Another admin would have to restore it.",
        confirmLabel: 'Remove my access',
        destructive: true,
      })
      if (!ok) return
    }
    try {
      await updateMember(m.id, { role: newRole })
      toast.success(`${m.name} is now ${newRole === 'admin' ? 'an admin' : 'a member'}`)
    } catch (err) {
      // The database refuses to demote the last remaining admin.
      toast.error(err.message || 'Could not change that role')
    }
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-text-primary mb-1">Member roles</h2>
        <p className="text-sm text-text-muted">Admins can manage the family, upload for others and create invite links. Tap a role to change it.</p>
      </div>

      <div className="space-y-2">
        {members.map(m => (
          <div key={m.id} className="flex items-center justify-between gap-3 py-3 px-3 rounded-xl hover:bg-surface-hover transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getAvatarGradient(m.name)} flex items-center justify-center text-white text-xs font-semibold shadow-sm shrink-0`}>
                {getInitials(m.name)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {m.name}{m.id === currentMemberId && <span className="text-text-muted font-normal"> (you)</span>}
                </p>
                <p className="text-xs text-text-muted truncate">{m.relationship}{m.user_id ? '' : ' · not joined yet'}</p>
              </div>
            </div>
            <button
              onClick={() => handleToggleAdmin(m)}
              aria-label={`Change ${m.name}'s role, currently ${m.role}`}
              className={`text-xs px-3 py-2 rounded-lg font-medium transition-all shrink-0 ${
                m.role === 'admin' ? 'bg-primary-100 text-primary-700 hover:bg-primary-200' : 'bg-stone-100 text-text-secondary hover:bg-stone-200'
              }`}
            >
              {m.role}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatAgo(ts, now) {
  if (!ts) return 'never'
  const diff = now - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

function OfflineSettings({ familyId }) {
  const { state, progress, lastSyncedAt, failedCount } = useSyncStatus()
  const { confirm } = useDialog()
  const toast = useToast()
  const [stats, setStats] = useState({ docCount: 0, fileCount: 0, bytes: 0, lastSyncedAt: null })
  const [enabled, setEnabled] = useState(isOfflineEnabled)
  const [now, setNow] = useState(() => Date.now())
  const [statsVersion, setStatsVersion] = useState(0)

  const refreshStats = useCallback(() => setStatsVersion(v => v + 1), [])

  useEffect(() => {
    let alive = true
    getCacheStats().then(s => { if (alive) setStats(s) })
    return () => { alive = false }
  }, [state, statsVersion])

  // While syncing, refresh the size/count card every 2s so the user sees
  // bytes climb. Without this, the UI only updates at sync start/end.
  useEffect(() => {
    if (state !== 'syncing') return
    const id = setInterval(() => setStatsVersion(v => v + 1), 2000)
    return () => clearInterval(id)
  }, [state])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  async function handleToggle(next) {
    setOfflineEnabled(next)
    setEnabled(next)
    if (next) {
      if (familyId) syncAllDocs(familyId)
    } else {
      await clearOfflineCache()
      refreshStats()
      toast.success('Offline copies removed from this device')
    }
  }

  async function handleClear() {
    const ok = await confirm({
      title: 'Clear offline copies?',
      message: "Documents stay safe in the vault. You'll need to be online to open them again on this device.",
      confirmLabel: 'Clear',
      destructive: true,
    })
    if (!ok) return
    await clearOfflineCache()
    refreshStats()
    toast.success('Offline copies cleared')
  }

  const syncing = state === 'syncing'
  const hasPartialFailure = state === 'synced-with-errors' && failedCount > 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-text-primary mb-1">Offline access</h2>
        <p className="text-sm text-text-muted">
          Keeps an encrypted copy of your family's documents on this device so you can open them without internet.
          Turn this off on shared or borrowed devices.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 bg-surface rounded-xl p-4 border border-stone-200/60">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">Keep documents on this device</p>
          <p className="text-xs text-text-muted mt-0.5">{enabled ? 'Documents are downloaded and encrypted here' : 'Nothing is stored on this device'}</p>
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          aria-label="Keep documents on this device"
          onClick={() => handleToggle(!enabled)}
          className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${enabled ? 'bg-primary-600' : 'bg-stone-300'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      {enabled && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-surface rounded-xl p-4 border border-stone-200/60">
              <p className="text-xs text-text-muted">Saved here</p>
              <p className="text-lg font-semibold text-text-primary mt-0.5">{stats.docCount}</p>
              <p className="text-xs text-text-muted">documents</p>
            </div>
            <div className="bg-surface rounded-xl p-4 border border-stone-200/60">
              <p className="text-xs text-text-muted">Size</p>
              <p className="text-lg font-semibold text-text-primary mt-0.5">{formatFileSize(stats.bytes)}</p>
              <p className="text-xs text-text-muted">on device</p>
            </div>
            <div className="bg-surface rounded-xl p-4 border border-stone-200/60">
              <p className="text-xs text-text-muted">Last updated</p>
              <p className="text-lg font-semibold text-text-primary mt-0.5">{formatAgo(lastSyncedAt || stats.lastSyncedAt, now)}</p>
              <p className="text-xs text-text-muted">&nbsp;</p>
            </div>
          </div>

          {syncing && progress && (
            <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
              <div className="flex items-center justify-between text-sm text-primary-700 mb-2">
                <span className="font-medium">Saving documents…</span>
                <span>{progress.current} / {progress.total}</span>
              </div>
              <div className="h-1.5 bg-primary-100 rounded-full overflow-hidden">
                <div className="h-full bg-primary-600 transition-all" style={{ width: progress.total ? `${(progress.current / progress.total) * 100}%` : '0%' }} />
              </div>
            </div>
          )}

          {hasPartialFailure && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
              <p className="font-medium">{failedCount} file{failedCount === 1 ? '' : 's'} couldn't be saved</p>
              <p className="text-xs mt-0.5 opacity-90">They'll still open when you're online. Try updating again.</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => syncAllDocs(familyId)}
              disabled={syncing || !navigator.onLine}
              className="inline-flex items-center gap-1.5 px-4 py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors active:scale-[0.98]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
              {syncing ? 'Updating…' : 'Update now'}
            </button>
            <button
              onClick={handleClear}
              disabled={syncing || stats.fileCount === 0}
              className="inline-flex items-center gap-1.5 px-4 py-3 bg-surface border border-stone-300 text-text-secondary rounded-xl text-sm font-medium hover:bg-surface-hover disabled:opacity-50 transition-colors active:scale-[0.98]"
            >
              Clear from this device
            </button>
          </div>
        </>
      )}

      <div className="pt-4 border-t border-stone-100">
        <p className="text-xs text-text-muted">
          <strong className="text-text-secondary">Security:</strong> Saved files are encrypted with a key that never leaves this browser.
          Anyone who can open the app while you're signed in can read them — turn this off on shared devices.
        </p>
      </div>
    </div>
  )
}
