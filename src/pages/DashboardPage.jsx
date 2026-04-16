import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useMembers } from '../hooks/useMembers'
import { useAllDocuments } from '../hooks/useAllDocuments'
import { useRecentlyViewed } from '../hooks/useRecentlyViewed'
import { useStarred } from '../hooks/useStarred'
import { getAvatarGradient, getInitials } from '../utils/avatar'
import { getThumbPath, isThumbMissing, markThumbMissing } from '../lib/thumbnails'
import DocumentPreview from '../components/DocumentPreview'
import StorageWarning from '../components/StorageWarning'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { member, isAdmin } = useAuth()
  const { members } = useMembers(member?.family_id)
  const { documents, loading, getSignedUrl, deleteDocument } = useAllDocuments(member?.family_id)
  const { recentIds, trackView } = useRecentlyViewed(member?.user_id)
  const { toggleStar, isStarred } = useStarred(member?.user_id)

  const [selectedMember, setSelectedMember] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [showStarred, setShowStarred] = useState(false)
  const [search, setSearch] = useState('')
  const [previewDoc, setPreviewDoc] = useState(null)

  const recentDocs = useMemo(() => {
    if (!documents.length) return []
    return recentIds.map(id => documents.find(d => d.id === id)).filter(Boolean).slice(0, 8)
  }, [recentIds, documents])

  // Derive unique categories from documents
  const categories = useMemo(() => {
    const map = new Map()
    for (const doc of documents) {
      const name = doc.categories?.name
      if (name && !map.has(name)) map.set(name, doc.category_id)
    }
    return [...map.entries()].map(([name, id]) => ({ name, id }))
  }, [documents])

  const filtered = useMemo(() => {
    let result = documents
    if (showStarred) {
      result = result.filter(d => isStarred(d.id))
    }
    if (selectedMember) {
      result = result.filter(d => d.members?.id === selectedMember)
    }
    if (selectedCategory) {
      result = result.filter(d => d.categories?.name === selectedCategory)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(d =>
        d.label.toLowerCase().includes(q) ||
        d.members?.name?.toLowerCase().includes(q) ||
        d.members?.relationship?.toLowerCase().includes(q) ||
        d.categories?.name?.toLowerCase().includes(q)
      )
    }
    return result
  }, [documents, selectedMember, selectedCategory, showStarred, isStarred, search])

  async function handleDownload(doc) {
    try {
      const url = await getSignedUrl(doc.file_url)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.label + '.' + doc.file_url.split('.').pop()
      a.click()
    } catch (err) {
      console.warn('Download failed', err)
      throw err
    }
  }

  async function handleDelete(doc) {
    if (!confirm(`Delete "${doc.label}"?`)) return
    await deleteDocument(doc)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-7 w-7 border-2 border-primary-600 border-t-transparent" />
    </div>
  )

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-5">
      <StorageWarning familyId={member?.family_id} />

      {recentDocs.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Recently Viewed</h2>
          <div className="flex gap-2.5 overflow-x-auto py-1 scrollbar-hide -mx-1 px-1">
            {recentDocs.map(doc => (
              <RecentCard key={doc.id} doc={doc} getSignedUrl={getSignedUrl} onPreview={() => { trackView(doc.id); setPreviewDoc(doc) }} />
            ))}
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search documents, members, categories..."
          className="w-full pl-11 pr-4 py-3 bg-surface-card border border-stone-200 rounded-2xl text-sm text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 outline-none transition-all shadow-sm"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-surface-hover text-text-muted">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* Member filter row */}
      <div className="flex gap-2 overflow-x-auto py-1 scrollbar-hide -mx-1 px-1">
        <button
          onClick={() => setSelectedMember(null)}
          className={`shrink-0 flex flex-col items-center gap-1 px-1 ${!selectedMember ? '' : 'opacity-50'}`}
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-semibold transition-all ${
            !selectedMember ? 'bg-primary-600 text-white shadow-md shadow-primary-200 ring-2 ring-primary-300' : 'bg-stone-200 text-text-secondary'
          }`}>
            All
          </div>
          <span className="text-[11px] text-text-muted font-medium">All</span>
        </button>
        {members.map(m => {
          const active = selectedMember === m.id
          const gradient = getAvatarGradient(m.name)
          return (
            <button
              key={m.id}
              onClick={() => setSelectedMember(active ? null : m.id)}
              className={`shrink-0 flex flex-col items-center gap-1 px-1 transition-opacity ${active ? '' : selectedMember ? 'opacity-50' : ''}`}
            >
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-sm font-semibold shadow-sm transition-all ${
                active ? 'ring-2 ring-primary-400 shadow-md' : ''
              }`}>
                {m.avatar_url
                  ? <img src={m.avatar_url} className="w-12 h-12 rounded-2xl object-cover" alt="" />
                  : getInitials(m.name)
                }
              </div>
              <span className="text-[11px] text-text-muted font-medium text-center leading-tight break-words max-w-[72px]">{m.name}</span>
            </button>
          )
        })}
      </div>

      {/* Category filter chips */}
      {categories.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto py-1 scrollbar-hide -mx-1 px-1">
          <button
            onClick={() => setShowStarred(!showStarred)}
            className={`shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              showStarred ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' : 'bg-stone-100 text-text-secondary hover:bg-stone-200'
            }`}
          >
            <svg className="w-3 h-3" fill={showStarred ? 'currentColor' : 'none'} viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>
            Starred
          </button>
          <button
            onClick={() => setSelectedCategory(null)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              !selectedCategory ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-200' : 'bg-stone-100 text-text-secondary hover:bg-stone-200'
            }`}
          >
            All Categories
          </button>
          {categories.map(cat => (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedCategory === cat.name ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-200' : 'bg-stone-100 text-text-secondary hover:bg-stone-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">
          {filtered.length} document{filtered.length !== 1 ? 's' : ''}
          {(selectedMember || selectedCategory || showStarred || search) ? ' (filtered)' : ''}
        </p>
        {(selectedMember || selectedCategory || showStarred || search) && (
          <button
            onClick={() => { setSelectedMember(null); setSelectedCategory(null); setShowStarred(false); setSearch('') }}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Document grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Zm3.75 11.625a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>
          </div>
          {documents.length === 0 ? (
            <>
              <p className="text-text-secondary font-medium">No documents yet</p>
              <p className="text-sm text-text-muted mt-1">Upload your first document to get started.</p>
              {isAdmin && (
                <button
                  onClick={() => navigate('/family')}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors active:scale-[0.98]"
                >
                  Go to Family to Upload
                </button>
              )}
            </>
          ) : (
            <>
              <p className="text-text-secondary font-medium">No matches found</p>
              <p className="text-sm text-text-muted mt-1">Try a different search or filter.</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(doc => (
            <DocCard
              key={doc.id}
              doc={doc}
              getSignedUrl={getSignedUrl}
              onPreview={() => { trackView(doc.id); setPreviewDoc(doc) }}
              onDownload={() => handleDownload(doc)}
              onDelete={isAdmin ? () => handleDelete(doc) : null}
              starred={isStarred(doc.id)}
              onToggleStar={() => toggleStar(doc.id)}
            />
          ))}
        </div>
      )}

      {/* Spacer for FAB overlap on mobile */}
      {isAdmin && documents.length > 0 && <div className="h-20 md:h-0" />}

      {/* Upload FAB with member picker */}
      {isAdmin && documents.length > 0 && <UploadFab members={members} selectedMember={selectedMember} />}

      {/* Preview */}
      {previewDoc && (
        <DocumentPreview doc={previewDoc} getSignedUrl={getSignedUrl} onClose={() => setPreviewDoc(null)} />
      )}
    </div>
  )
}

function DocCard({ doc, getSignedUrl, onPreview, onDownload, onDelete, starred, onToggleStar }) {
  const [downloading, setDownloading] = useState(false)
  const [thumbUrl, setThumbUrl] = useState(null)
  const isImage = doc.file_type?.startsWith('image/')
  const memberName = doc.members?.name || ''
  const category = doc.categories?.name || ''
  const gradient = getAvatarGradient(memberName)

  useEffect(() => {
    if (!isImage || !getSignedUrl) return
    let cancelled = false
    const thumbPath = getThumbPath(doc.file_url)
    const fetchFull = () => getSignedUrl(doc.file_url)
      .then(url => { if (!cancelled) setThumbUrl(url) })
      .catch(() => {})
    if (isThumbMissing(thumbPath)) {
      fetchFull()
    } else {
      getSignedUrl(thumbPath)
        .then(url => { if (!cancelled) setThumbUrl(url) })
        .catch(() => { if (!cancelled) fetchFull() })
    }
    return () => { cancelled = true }
  }, [doc.file_url, isImage, getSignedUrl])

  const [dlError, setDlError] = useState(false)

  async function handleDl(e) {
    e.stopPropagation()
    setDownloading(true)
    setDlError(false)
    try {
      await onDownload()
    } catch {
      setDlError(true)
      setTimeout(() => setDlError(false), 3000)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="group bg-surface-card rounded-2xl border border-stone-200/60 overflow-hidden hover:shadow-lg hover:shadow-stone-200/50 hover:border-stone-300/60 transition-all duration-200">
      {/* Tap to preview — show actual thumbnail for images */}
      <button onClick={onPreview} className="w-full h-28 bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center relative overflow-hidden">
        {isImage && thumbUrl ? (
          <img
            src={thumbUrl}
            alt={doc.label}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => {
              markThumbMissing(getThumbPath(doc.file_url))
              if (getSignedUrl) {
                getSignedUrl(doc.file_url).then(url => setThumbUrl(url)).catch(() => setThumbUrl(null))
              }
            }}
          />
        ) : (
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isImage ? 'bg-sky-100 text-sky-600' : 'bg-amber-100 text-amber-600'}`}>
            {isImage ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
            )}
          </div>
        )}
        <span className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium text-text-secondary bg-white/90 backdrop-blur px-2 py-0.5 rounded-full shadow-sm">Preview</span>
        </span>
      </button>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-1">
          <p className="font-medium text-sm text-text-primary truncate leading-tight">{doc.label}</p>
          {onToggleStar && (
            <button onClick={(e) => { e.stopPropagation(); onToggleStar() }} className="shrink-0 p-0.5 -mt-0.5 -mr-0.5">
              <svg className={`w-3.5 h-3.5 transition-colors ${starred ? 'text-amber-400 fill-amber-400' : 'text-stone-300 hover:text-amber-300'}`} fill={starred ? 'currentColor' : 'none'} viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>
            </button>
          )}
        </div>
        {doc.notes && <p className="text-[10px] text-text-muted truncate mt-0.5">{doc.notes}</p>}
        <div className="flex items-center gap-1.5 mt-1.5">
          <div className={`w-4 h-4 rounded bg-gradient-to-br ${gradient} flex items-center justify-center text-white shrink-0`}>
            <span className="text-[7px] font-bold">{getInitials(memberName).charAt(0)}</span>
          </div>
          <span className="text-[11px] text-text-muted truncate">{memberName} &middot; {category}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 mt-2.5">
          <button
            onClick={handleDl}
            disabled={downloading}
            className={`flex-1 inline-flex items-center justify-center gap-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${
              dlError ? 'bg-red-50 text-red-600' : 'bg-primary-50 text-primary-700 hover:bg-primary-100'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            {dlError ? 'Failed' : downloading ? '...' : 'Download'}
          </button>
          {onDelete && (
            <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="p-1.5 text-stone-300 hover:text-red-500 rounded-lg transition-colors" title="Delete">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function RecentCard({ doc, getSignedUrl, onPreview }) {
  const [thumbUrl, setThumbUrl] = useState(null)
  const isImage = doc.file_type?.startsWith('image/')

  useEffect(() => {
    if (!isImage || !getSignedUrl) return
    let cancelled = false
    const thumbPath = getThumbPath(doc.file_url)
    const fetchFull = () => getSignedUrl(doc.file_url)
      .then(url => { if (!cancelled) setThumbUrl(url) })
      .catch(() => {})
    if (isThumbMissing(thumbPath)) {
      fetchFull()
    } else {
      getSignedUrl(thumbPath)
        .then(url => { if (!cancelled) setThumbUrl(url) })
        .catch(() => { if (!cancelled) fetchFull() })
    }
    return () => { cancelled = true }
  }, [doc.file_url, isImage, getSignedUrl])

  return (
    <button
      onClick={onPreview}
      className="shrink-0 w-24 bg-surface-card rounded-xl border border-stone-200/60 overflow-hidden hover:shadow-md transition-all"
    >
      <div className="h-16 bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center overflow-hidden">
        {isImage && thumbUrl ? (
          <img
            src={thumbUrl}
            alt={doc.label}
            className="w-full h-full object-cover"
            onError={() => {
              markThumbMissing(getThumbPath(doc.file_url))
              if (getSignedUrl) getSignedUrl(doc.file_url).then(url => setThumbUrl(url)).catch(() => setThumbUrl(null))
            }}
          />
        ) : (
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isImage ? 'bg-sky-100 text-sky-600' : 'bg-amber-100 text-amber-600'}`}>
            {isImage ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" /></svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
            )}
          </div>
        )}
      </div>
      <p className="text-[10px] font-medium text-text-primary truncate px-2 py-1.5">{doc.label}</p>
    </button>
  )
}

function UploadFab({ members, selectedMember }) {
  const navigate = useNavigate()
  const [showPicker, setShowPicker] = useState(false)

  function handleClick() {
    if (selectedMember) {
      navigate(`/member/${selectedMember}/upload`)
    } else if (members.length === 1) {
      navigate(`/member/${members[0].id}/upload`)
    } else {
      setShowPicker(true)
    }
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="fixed bottom-24 md:bottom-6 right-4 md:right-8 w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-700 text-white rounded-2xl shadow-lg shadow-primary-300/50 hover:shadow-xl hover:shadow-primary-300/50 flex items-center justify-center transition-all active:scale-90 z-20"
        aria-label="Upload document"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
      </button>

      {/* Member picker popup */}
      {showPicker && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4" onClick={() => setShowPicker(false)}>
          <div className="w-full max-w-sm bg-surface-card rounded-2xl shadow-2xl border border-stone-200/60 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-stone-100">
              <h3 className="text-base font-semibold text-text-primary">Upload for who?</h3>
              <p className="text-xs text-text-muted mt-0.5">Select a family member</p>
            </div>
            <div className="p-2 max-h-64 overflow-auto">
              {members.map(m => {
                const grad = getAvatarGradient(m.name)
                return (
                  <button
                    key={m.id}
                    onClick={() => { setShowPicker(false); navigate(`/member/${m.id}/upload`) }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-hover transition-colors text-left"
                  >
                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${grad} flex items-center justify-center text-white text-xs font-semibold shadow-sm shrink-0`}>
                      {getInitials(m.name)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">{m.name}</p>
                      <p className="text-xs text-text-muted">{m.relationship}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
