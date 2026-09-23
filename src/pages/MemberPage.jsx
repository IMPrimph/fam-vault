import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useDialog } from '../context/DialogContext'
import { useMembers } from '../hooks/useMembers'
import { useAllDocuments } from '../hooks/useAllDocuments'
import { useMemberIds } from '../hooks/useMemberIds'
import { useCategories } from '../hooks/useCategories'
import { buildPeople, otherFilesRecord } from '../lib/idRecords'
import { getCachedSignedUrl } from '../lib/signedUrlCache'
import { Avatar } from '../components/ids/PersonCard'
import RecordDetail from '../components/ids/RecordDetail'
import { PlusIcon, DownloadIcon, TrashIcon } from '../components/ids/icons'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

export default function MemberPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { member: authMember, isAdmin } = useAuth()
  const toast = useToast()
  const { confirm } = useDialog()
  const familyId = authMember?.family_id
  const { members, deleteMember, loading: membersLoading } = useMembers(familyId)
  const { documents: allDocs, loading: docsLoading } = useAllDocuments(familyId)
  const { memberIds } = useMemberIds(familyId)
  const { categories } = useCategories(familyId)
  const [zipping, setZipping] = useState(false)

  const person = useMemo(() => {
    const target = members.find(m => m.id === id)
    if (!target) return null
    return buildPeople({ members: [target], documents: allDocs.filter(d => d.member_id === id), memberIds, categories })[0]
  }, [members, allDocs, memberIds, categories, id])

  const targetMember = person?.member
  const documents = useMemo(() => allDocs.filter(d => d.member_id === id), [allDocs, id])
  const canUpload = isAdmin || id === authMember?.id
  const canDeleteMember = isAdmin && targetMember?.id !== authMember?.id
  const numberCount = person?.records.filter(r => r.idNumber).length || 0

  async function handleDeleteMember() {
    const ok = await confirm({
      title: `Remove ${targetMember.name}?`,
      message: `${targetMember.name} and all ${documents.length} of their documents will be permanently deleted. This can't be undone.`,
      confirmLabel: 'Delete member',
      destructive: true,
    })
    if (!ok) return
    try {
      await deleteMember(targetMember.id)
      toast.success(`Removed ${targetMember.name}`)
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.message || 'Could not remove this member')
    }
  }

  async function handleDownloadAll() {
    if (!documents.length) return
    setZipping(true)
    const zip = new JSZip()
    let added = 0
    const failures = []
    try {
      for (const doc of documents) {
        try {
          const url = await getCachedSignedUrl(doc.file_url)
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
        toast.error('Could not download any documents. Check your connection.')
        return
      }
      const content = await zip.generateAsync({ type: 'blob' })
      saveAs(content, `${targetMember?.name || 'documents'}.zip`)
      if (failures.length) {
        toast.info(`Downloaded ${added}, skipped ${failures.length} that failed.`)
      } else {
        toast.success(`Downloaded ${added} ${added === 1 ? 'document' : 'documents'}`)
      }
    } finally {
      setZipping(false)
    }
  }

  if ((membersLoading || docsLoading) && !person) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-7 w-7 border-2 border-primary-600 border-t-transparent" />
    </div>
  )

  if (!person) return (
    <div className="p-6 text-center py-20">
      <p className="text-text-secondary font-medium">This person isn't in your family tree</p>
      <button onClick={() => navigate('/dashboard')} className="mt-4 min-h-11 px-4 bg-primary-600 text-white rounded-xl text-sm font-semibold">Back home</button>
    </div>
  )

  const otherRecord = otherFilesRecord(person)
  const sections = otherRecord ? [...person.records, otherRecord] : person.records

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto">
      <nav className="flex items-center gap-1.5 text-xs text-text-muted mb-4">
        <button onClick={() => navigate('/dashboard')} className="hover:text-primary-600 transition-colors min-h-8">Home</button>
        <span aria-hidden="true">›</span>
        <span className="text-text-secondary font-medium truncate">{targetMember.name}</span>
      </nav>

      <div className="bg-surface-card rounded-2xl border border-stone-200/60 p-4 sm:p-5 mb-5">
        <div className="flex items-center gap-4">
          <Avatar member={targetMember} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-text-primary truncate">{targetMember.name}</h1>
            <p className="text-sm text-text-muted">
              {targetMember.relationship} · {person.records.length} {person.records.length === 1 ? 'ID' : 'IDs'} · {numberCount} {numberCount === 1 ? 'number' : 'numbers'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-4">
          {canUpload && (
            <button
              onClick={() => navigate(`/member/${id}/upload`)}
              className="inline-flex items-center gap-1.5 min-h-11 px-4 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors active:scale-[0.98]"
            >
              <PlusIcon /> Add ID
            </button>
          )}
          {documents.length > 0 && (
            <button
              onClick={handleDownloadAll}
              disabled={zipping}
              className="inline-flex items-center gap-1.5 min-h-11 px-4 bg-surface border border-stone-200 text-text-secondary rounded-xl text-sm font-medium hover:bg-surface-hover disabled:opacity-50 transition-colors"
            >
              <DownloadIcon /> {zipping ? 'Preparing…' : 'Download all'}
            </button>
          )}
          {canDeleteMember && (
            <button
              onClick={handleDeleteMember}
              className="ml-auto inline-flex items-center gap-1.5 min-h-11 px-3 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium transition-colors"
            >
              <TrashIcon className="w-3.5 h-3.5" /> Remove
            </button>
          )}
        </div>
      </div>

      {sections.length ? (
        <div className="space-y-4">
          {sections.map(record => (
            <section key={record.key} className="bg-surface-card rounded-2xl border border-stone-200/60 p-4 sm:p-5" aria-label={record.categoryName}>
              <h2 className="text-base font-semibold text-text-primary mb-3">{record.categoryName}</h2>
              <RecordDetail record={record} member={targetMember} />
            </section>
          ))}
        </div>
      ) : (
        <p className="text-center text-text-muted py-12">
          No IDs yet.{canUpload ? ' Use Add ID to save a number or upload a card.' : ''}
        </p>
      )}
    </div>
  )
}
