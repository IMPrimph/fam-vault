import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useDialog } from '../../context/DialogContext'
import { useMemberIds } from '../../hooks/useMemberIds'
import { useAllDocuments } from '../../hooks/useAllDocuments'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { getCachedSignedUrl } from '../../lib/signedUrlCache'
import { formatIdNumber, copyValue } from '../../lib/idTypes'
import DocumentPreview from '../DocumentPreview'
import EditDocumentForm from '../EditDocumentForm'
import CopyButton from './CopyButton'
import NumberEditor from './NumberEditor'
import FileThumb from './FileThumb'
import { PencilIcon, PlusIcon } from './icons'

/**
 * Everything about one ID: the number (copy / edit / scan) and its files.
 * Shared by the ID sheet and the person page.
 *
 * `onOverlayChange(open)` tells a containing sheet when a full-screen preview
 * or edit dialog is up, so Escape closes that rather than the sheet under it.
 */
export default function RecordDetail({ record, member, startEditing = false, onOverlayChange }) {
  const navigate = useNavigate()
  const { member: me, isAdmin } = useAuth()
  const toast = useToast()
  const { confirm } = useDialog()
  const online = useOnlineStatus()
  const familyId = me?.family_id
  const { saveNumber } = useMemberIds(familyId)
  const { deleteDocument } = useAllDocuments(familyId)

  const [editing, setEditing] = useState(startEditing)
  const [previewDoc, setPreviewDoc] = useState(null)
  const [editingDoc, setEditingDoc] = useState(null)

  const canEditPerson = isAdmin || member.id === me?.id
  const canModifyDoc = (doc) => isAdmin || doc.uploaded_by === me?.user_id
  const hasCategory = !!record.categoryId
  const shown = formatIdNumber(record.type, record.idNumber)
  const toastLabel = `${member.name}'s ${record.categoryName}`

  const overlayOpen = !!previewDoc || !!editingDoc
  useEffect(() => { onOverlayChange?.(overlayOpen) }, [overlayOpen, onOverlayChange])

  async function handleSave(idNumber) {
    await saveNumber({ memberId: member.id, categoryId: record.categoryId, idNumber })
    toast.success(idNumber ? `Saved ${toastLabel} number` : `Removed ${toastLabel} number`)
    setEditing(false)
  }

  async function handleDelete(doc) {
    const ok = await confirm({
      title: 'Delete this file?',
      message: `"${doc.label}" will be permanently removed for everyone in the family. The saved number is kept.`,
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return
    try {
      await deleteDocument(doc)
      toast.success(`Deleted "${doc.label}"`)
    } catch (err) {
      toast.error(err.message || 'Could not delete the file')
    }
  }

  const docs = [...record.docs].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))

  return (
    <div className="space-y-5">
      {hasCategory && (
        <div>
          {editing ? (
            <NumberEditor
              type={record.type}
              categoryName={record.categoryName}
              initialValue={record.idNumber}
              docs={record.docs}
              onSave={handleSave}
              onCancel={() => setEditing(false)}
            />
          ) : shown ? (
            <div className="bg-surface rounded-2xl border border-stone-200/60 p-4">
              <p className="text-xs font-medium text-text-muted mb-1">{record.categoryName} number</p>
              <CopyButton variant="number" value={copyValue(record.type, record.idNumber)} display={shown} toastLabel={toastLabel} className="!text-2xl !px-0 !mx-0 break-all" />
              <div className="flex gap-2 mt-3">
                <CopyButton variant="primary" value={copyValue(record.type, record.idNumber)} toastLabel={toastLabel} className="flex-1 sm:flex-none" />
                {canEditPerson && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    disabled={!online}
                    title={online ? 'Edit number' : 'Needs internet'}
                    className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-xl text-sm font-medium text-text-secondary bg-surface-card border border-stone-300 hover:bg-surface-hover disabled:opacity-50 transition-colors"
                  >
                    <PencilIcon className="w-3.5 h-3.5" /> Edit
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-surface rounded-2xl border border-dashed border-stone-300 p-4 flex items-center justify-between gap-3">
              <p className="text-sm text-text-muted">No number saved</p>
              {canEditPerson && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  disabled={!online}
                  title={online ? undefined : 'Needs internet'}
                  className="inline-flex items-center gap-1 min-h-11 px-4 rounded-xl text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  <PlusIcon className="w-3.5 h-3.5" /> Add number
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-sm font-semibold text-text-secondary">
            Files <span className="text-text-muted font-normal">{docs.length}</span>
          </h3>
          {canEditPerson && hasCategory && (
            <button
              type="button"
              onClick={() => navigate(`/member/${member.id}/upload?category=${record.categoryId}`)}
              className="inline-flex items-center gap-1 min-h-10 px-3 rounded-lg text-sm font-medium text-primary-600 hover:bg-primary-50 transition-colors"
            >
              <PlusIcon className="w-3.5 h-3.5" /> Add file
            </button>
          )}
        </div>
        {docs.length ? (
          <div className="grid grid-cols-2 gap-2.5">
            {docs.map(doc => (
              <FileThumb
                key={doc.id}
                doc={doc}
                onOpen={() => setPreviewDoc(doc)}
                onEdit={canModifyDoc(doc) ? setEditingDoc : null}
                onDelete={canModifyDoc(doc) ? handleDelete : null}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">No files yet{canEditPerson ? '. Add a photo or PDF of the card.' : '.'}</p>
        )}
      </div>

      {previewDoc && (
        <DocumentPreview
          doc={previewDoc}
          getSignedUrl={getCachedSignedUrl}
          onClose={() => setPreviewDoc(null)}
          canEdit={canModifyDoc(previewDoc)}
          familyId={familyId}
        />
      )}
      {editingDoc && (
        <EditDocumentForm doc={editingDoc} familyId={familyId} onClose={() => setEditingDoc(null)} />
      )}
    </div>
  )
}
