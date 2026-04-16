import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useMembers } from '../hooks/useMembers'
import { useDocuments } from '../hooks/useDocuments'
import { getAvatarGradient, getInitials } from '../utils/avatar'
import DocumentGrid from '../components/DocumentGrid'
import DocumentPreview from '../components/DocumentPreview'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

export default function MemberPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { member: authMember, isAdmin } = useAuth()
  const { members, deleteMember } = useMembers(authMember?.family_id)
  const { documents, loading, deleteDocument, getSignedUrl } = useDocuments(id)
  const [previewDoc, setPreviewDoc] = useState(null)
  const [zipping, setZipping] = useState(false)
  const [zipError, setZipError] = useState('')

  const targetMember = members.find(m => m.id === id)
  const isOwnProfile = targetMember?.user_id === authMember?.user_id
  const canUpload = isAdmin || isOwnProfile
  const canDeleteDoc = (doc) => isAdmin || doc.uploaded_by === authMember?.user_id
  const canDeleteMember = isAdmin && targetMember?.id !== authMember?.id
  const gradient = targetMember ? getAvatarGradient(targetMember.name) : 'from-gray-400 to-gray-500'
  const initials = targetMember ? getInitials(targetMember.name) : '?'

  async function handleDelete(doc) {
    if (!confirm(`Delete "${doc.label}"? This cannot be undone.`)) return
    await deleteDocument(doc)
  }

  async function handleDeleteMember() {
    if (!confirm(`Delete ${targetMember.name} and all their documents? This cannot be undone.`)) return
    await deleteMember(targetMember.id)
    navigate('/dashboard')
  }

  async function handleDownloadAll() {
    if (!documents.length) return
    setZipping(true)
    setZipError('')
    const zip = new JSZip()
    let added = 0
    const failures = []
    try {
      for (const doc of documents) {
        try {
          const url = await getSignedUrl(doc.file_url)
          const resp = await fetch(url)
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
          const blob = await resp.blob()
          const ext = doc.file_url.split('.').pop()
          const catName = doc.categories?.name || 'Other'
          zip.file(`${catName}/${doc.label}.${ext}`, blob)
          added++
        } catch (err) {
          failures.push(doc.label)
          console.warn('Zip: skipping', doc.file_url, err)
        }
      }
      if (added === 0) {
        setZipError('Could not download any documents.')
        return
      }
      const content = await zip.generateAsync({ type: 'blob' })
      saveAs(content, `${targetMember?.name || 'documents'}.zip`)
      if (failures.length) setZipError(`Skipped ${failures.length} file${failures.length === 1 ? '' : 's'} that failed to download.`)
    } finally {
      setZipping(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-7 w-7 border-2 border-primary-600 border-t-transparent" />
    </div>
  )

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
      <nav className="flex items-center gap-1.5 text-xs text-text-muted mb-5">
        <button onClick={() => navigate('/dashboard')} className="hover:text-primary-600 transition-colors">Documents</button>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
        <span className="text-text-secondary font-medium truncate">{targetMember?.name || 'Member'}</span>
      </nav>

      {/* Profile header */}
      <div className="bg-surface-card rounded-2xl border border-stone-200/60 p-5 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-lg font-bold shadow-md shrink-0`}>
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-text-primary truncate">{targetMember?.name}</h1>
            <p className="text-sm text-text-muted">{targetMember?.relationship} &middot; {documents.length} document{documents.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {canUpload && (
              <button
                onClick={() => navigate(`/member/${id}/upload`)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors shadow-sm active:scale-[0.98]"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>
                Upload
              </button>
            )}
            {documents.length > 0 && (
              <div className="flex flex-col items-start gap-1">
                <button
                  onClick={handleDownloadAll}
                  disabled={zipping}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-surface border border-stone-200 text-text-secondary rounded-xl text-sm font-medium hover:bg-surface-hover transition-colors active:scale-[0.98]"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                  {zipping ? 'Zipping...' : 'Download All'}
                </button>
                {zipError && <p className="text-[11px] text-amber-600">{zipError}</p>}
              </div>
            )}
          </div>
          {canDeleteMember && (
            <button
              onClick={handleDeleteMember}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl text-xs font-medium transition-colors"
              aria-label="Delete member"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Documents */}
      <DocumentGrid
        documents={documents}
        onPreview={setPreviewDoc}
        onDelete={handleDelete}
        getSignedUrl={getSignedUrl}
        canDelete={canDeleteDoc}
      />

      {previewDoc && (
        <DocumentPreview doc={previewDoc} getSignedUrl={getSignedUrl} onClose={() => setPreviewDoc(null)} />
      )}
    </div>
  )
}
