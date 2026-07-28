import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useDialog } from '../context/DialogContext'
import { useMembers } from '../hooks/useMembers'
import { useAllDocuments } from '../hooks/useAllDocuments'
import { useRecentlyViewed } from '../hooks/useRecentlyViewed'
import { useStarred } from '../hooks/useStarred'
import { useThumbnail } from '../hooks/useThumbnail'
import { getAvatarGradient, getInitials } from '../utils/avatar'
import DocumentGrid from '../components/DocumentGrid'
import DocumentPreview from '../components/DocumentPreview'
import EditDocumentForm from '../components/EditDocumentForm'
import StorageWarning from '../components/StorageWarning'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { member, isAdmin } = useAuth()
  const toast = useToast()
  const { confirm } = useDialog()
  const { members } = useMembers(member?.family_id)
  const { documents, loading, getSignedUrl, deleteDocument } = useAllDocuments(member?.family_id)
  const { recentIds, trackView } = useRecentlyViewed(member?.user_id)
  const { toggleStar, isStarred } = useStarred(member?.user_id)

  const [selectedMember, setSelectedMember] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [showStarred, setShowStarred] = useState(false)
  const [search, setSearch] = useState('')
  const [previewDoc, setPreviewDoc] = useState(null)
  const [editingDoc, setEditingDoc] = useState(null)

  // A document can be changed by an admin or by whoever uploaded it. This
  // mirrors the documents_update/delete RLS policies and the delete_document
  // RPC, so the UI never offers an action the backend will reject.
  const canModify = (doc) => isAdmin || doc.uploaded_by === member?.user_id

  // Show the signed-in member first and label them, so "my documents" is one
  // tap away rather than a hunt through a row of similar-looking avatars.
  const selfMemberId = member?.id
  const orderedMembers = useMemo(() => {
    if (!selfMemberId) return members
    const self = members.find(m => m.id === selfMemberId)
    if (!self) return members
    return [self, ...members.filter(m => m.id !== selfMemberId)]
  }, [members, selfMemberId])

  const recentDocs = useMemo(() => {
    if (!documents.length) return []
    return recentIds.map(id => documents.find(d => d.id === id)).filter(Boolean).slice(0, 8)
  }, [recentIds, documents])

  // Categories present in the data, with counts so people can see where the
  // documents actually are before committing to a filter.
  const categories = useMemo(() => {
    const counts = new Map()
    for (const doc of documents) {
      const name = doc.categories?.name
      if (name) counts.set(name, (counts.get(name) || 0) + 1)
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [documents])

  const filtered = useMemo(() => {
    let result = documents
    if (showStarred) result = result.filter(d => isStarred(d.id))
    if (selectedMember) result = result.filter(d => d.members?.id === selectedMember)
    if (selectedCategory) result = result.filter(d => d.categories?.name === selectedCategory)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(d =>
        d.label.toLowerCase().includes(q) ||
        d.members?.name?.toLowerCase().includes(q) ||
        d.members?.relationship?.toLowerCase().includes(q) ||
        d.categories?.name?.toLowerCase().includes(q) ||
        d.notes?.toLowerCase().includes(q)
      )
    }
    return result
  }, [documents, selectedMember, selectedCategory, showStarred, isStarred, search])

  const hasFilters = !!(selectedMember || selectedCategory || showStarred || search)

  function clearFilters() {
    setSelectedMember(null)
    setSelectedCategory(null)
    setShowStarred(false)
    setSearch('')
  }

  async function handleDelete(doc) {
    const ok = await confirm({
      title: 'Delete this document?',
      message: `"${doc.label}" will be permanently removed for everyone in the family. This can't be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return
    try {
      await deleteDocument(doc)
      toast.success(`Deleted "${doc.label}"`)
    } catch (err) {
      toast.error(err.message || 'Could not delete the document')
    }
  }

  function handlePreview(doc) {
    trackView(doc.id)
    setPreviewDoc(doc)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-7 w-7 border-2 border-primary-600 border-t-transparent" role="status" aria-label="Loading documents" />
    </div>
  )

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-5">
      <StorageWarning familyId={member?.family_id} />

      {recentDocs.length > 0 && !hasFilters && (
        <section>
          <h2 className="text-sm font-semibold text-text-secondary mb-2.5">Recently viewed</h2>
          <div className="flex gap-2.5 overflow-x-auto py-1 scrollbar-hide -mx-1 px-1">
            {recentDocs.map(doc => (
              <RecentCard key={doc.id} doc={doc} getSignedUrl={getSignedUrl} onPreview={() => handlePreview(doc)} />
            ))}
          </div>
        </section>
      )}

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Search documents"
          placeholder="Search by name, person or category..."
          className="w-full pl-12 pr-4 py-3.5 bg-surface-card border border-stone-200 rounded-2xl text-base text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 outline-none transition-all shadow-sm"
        />
      </div>

      {/* Person filter */}
      {orderedMembers.length > 1 && (
        <div>
          <div className="flex gap-2 overflow-x-auto py-1 scrollbar-hide -mx-1 px-1">
            <button
              onClick={() => setSelectedMember(null)}
              aria-pressed={!selectedMember}
              className={`shrink-0 flex flex-col items-center gap-1 px-1 ${!selectedMember ? '' : 'opacity-60'}`}
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-sm font-semibold transition-all ${
                !selectedMember ? 'bg-primary-600 text-white shadow-md ring-2 ring-primary-300' : 'bg-stone-200 text-text-secondary'
              }`}>
                All
              </div>
              <span className="text-xs text-text-muted font-medium">Everyone</span>
            </button>
            {orderedMembers.map(m => {
              const active = selectedMember === m.id
              const isSelf = m.id === member?.id
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMember(active ? null : m.id)}
                  aria-pressed={active}
                  className={`shrink-0 flex flex-col items-center gap-1 px-1 transition-opacity ${active || !selectedMember ? '' : 'opacity-60'}`}
                >
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getAvatarGradient(m.name)} flex items-center justify-center text-white text-sm font-semibold shadow-sm transition-all ${
                    active ? 'ring-2 ring-primary-400 shadow-md' : ''
                  }`}>
                    {m.avatar_url
                      ? <img src={m.avatar_url} className="w-14 h-14 rounded-2xl object-cover" alt="" />
                      : getInitials(m.name)
                    }
                  </div>
                  <span className="text-xs text-text-muted font-medium text-center leading-tight break-words max-w-[76px]">
                    {isSelf ? 'You' : m.name}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Category + starred filters */}
      {categories.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto py-1 scrollbar-hide -mx-1 px-1">
          <button
            onClick={() => setShowStarred(!showStarred)}
            aria-pressed={showStarred}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
              showStarred ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' : 'bg-stone-100 text-text-secondary hover:bg-stone-200'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill={showStarred ? 'currentColor' : 'none'} viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>
            Starred
          </button>
          <button
            onClick={() => setSelectedCategory(null)}
            aria-pressed={!selectedCategory}
            className={`shrink-0 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
              !selectedCategory ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-200' : 'bg-stone-100 text-text-secondary hover:bg-stone-200'
            }`}
          >
            All types
          </button>
          {categories.map(cat => (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
              aria-pressed={selectedCategory === cat.name}
              className={`shrink-0 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedCategory === cat.name ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-200' : 'bg-stone-100 text-text-secondary hover:bg-stone-200'
              }`}
            >
              {cat.name} <span className="opacity-60">{cat.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Result summary */}
      {hasFilters && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-text-secondary">
            {filtered.length} {filtered.length === 1 ? 'document' : 'documents'} found
          </p>
          <button onClick={clearFilters} className="text-sm text-primary-600 hover:text-primary-700 font-semibold">
            Clear filters
          </button>
        </div>
      )}

      {/* Results */}
      {documents.length === 0 ? (
        <EmptyVault memberId={member?.id} onUpload={() => navigate(`/member/${member?.id}/upload`)} />
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
          </div>
          <p className="text-text-secondary font-medium">Nothing matches that</p>
          <p className="text-sm text-text-muted mt-1">Try a different word, or clear the filters.</p>
          <button onClick={clearFilters} className="mt-4 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors">
            Clear filters
          </button>
        </div>
      ) : (
        <DocumentGrid
          documents={filtered}
          grouped={!selectedCategory}
          showMember
          onPreview={handlePreview}
          onDelete={handleDelete}
          onEdit={setEditingDoc}
          onToggleStar={toggleStar}
          isStarred={isStarred}
          getSignedUrl={getSignedUrl}
          canDelete={canModify}
          canEdit={canModify}
        />
      )}

      {/* Space so the FAB never covers the last row on mobile */}
      {documents.length > 0 && <div className="h-20 md:h-0" />}
      {documents.length > 0 && (
        <UploadFab
          members={members}
          selectedMember={selectedMember}
          isAdmin={isAdmin}
          ownMemberId={member?.id}
        />
      )}

      {previewDoc && (
        <DocumentPreview
          doc={previewDoc}
          getSignedUrl={getSignedUrl}
          onClose={() => setPreviewDoc(null)}
          canEdit={canModify(previewDoc)}
          familyId={member?.family_id}
        />
      )}
      {editingDoc && (
        <EditDocumentForm doc={editingDoc} familyId={member?.family_id} onClose={() => setEditingDoc(null)} />
      )}
    </div>
  )
}

function EmptyVault({ memberId, onUpload }) {
  return (
    <div className="text-center py-16">
      <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-4">
        <svg className="w-7 h-7 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" /></svg>
      </div>
      <p className="text-text-secondary font-medium">No documents yet</p>
      <p className="text-sm text-text-muted mt-1 max-w-xs mx-auto">Add a photo or PDF of an ID card and it'll be here whenever you need it.</p>
      {memberId && (
        <button
          onClick={onUpload}
          className="mt-5 inline-flex items-center gap-1.5 px-5 py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors active:scale-[0.98]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Add your first document
        </button>
      )}
    </div>
  )
}

function RecentCard({ doc, getSignedUrl, onPreview }) {
  const { thumbUrl, isImage, handleImageError } = useThumbnail(doc, getSignedUrl)

  return (
    <button
      onClick={onPreview}
      className="shrink-0 w-28 bg-surface-card rounded-xl border border-stone-200/60 overflow-hidden hover:shadow-md transition-all text-left"
    >
      <div className="h-20 bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center overflow-hidden">
        {isImage && thumbUrl ? (
          <img src={thumbUrl} alt="" className="w-full h-full object-cover" onError={handleImageError} />
        ) : (
          <svg className="w-7 h-7 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
        )}
      </div>
      <p className="text-xs font-medium text-text-primary truncate px-2 py-2">{doc.label}</p>
    </button>
  )
}

/**
 * Upload shortcut. Members may only upload to their own profile, so for them
 * this is a direct link; admins get a person picker since they can file a
 * document under anyone.
 */
function UploadFab({ members, selectedMember, isAdmin, ownMemberId }) {
  const navigate = useNavigate()
  const [showPicker, setShowPicker] = useState(false)

  function handleClick() {
    if (!isAdmin) {
      if (ownMemberId) navigate(`/member/${ownMemberId}/upload`)
      return
    }
    if (selectedMember) navigate(`/member/${selectedMember}/upload`)
    else if (members.length === 1) navigate(`/member/${members[0].id}/upload`)
    else setShowPicker(true)
  }

  if (!isAdmin && !ownMemberId) return null

  return (
    <>
      <button
        onClick={handleClick}
        className="fixed bottom-24 md:bottom-6 right-4 md:right-8 h-14 pl-4 pr-5 bg-gradient-to-br from-primary-500 to-primary-700 text-white rounded-2xl shadow-lg shadow-primary-300/50 hover:shadow-xl flex items-center gap-2 transition-all active:scale-95 z-20 font-semibold"
        aria-label={isAdmin ? 'Upload a document' : 'Upload one of your documents'}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
        <span className="text-sm">Add</span>
      </button>

      {showPicker && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4" onClick={() => setShowPicker(false)}>
          <div className="w-full max-w-sm bg-surface-card rounded-2xl shadow-2xl border border-stone-200/60 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-stone-100">
              <h3 className="text-base font-semibold text-text-primary">Whose document is this?</h3>
            </div>
            <div className="p-2 max-h-72 overflow-auto">
              {members.map(m => (
                <button
                  key={m.id}
                  onClick={() => { setShowPicker(false); navigate(`/member/${m.id}/upload`) }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-surface-hover transition-colors text-left"
                >
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getAvatarGradient(m.name)} flex items-center justify-center text-white text-xs font-semibold shadow-sm shrink-0`}>
                    {getInitials(m.name)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{m.name}</p>
                    <p className="text-xs text-text-muted">{m.relationship}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
