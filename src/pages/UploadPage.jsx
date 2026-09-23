import { useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useDocuments } from '../hooks/useDocuments'
import { useMembers } from '../hooks/useMembers'
import { useMemberIds } from '../hooks/useMemberIds'
import { Avatar } from '../components/ids/PersonCard'
import UploadForm from '../components/UploadForm'

export default function UploadPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { member: authMember, isAdmin } = useAuth()
  const toast = useToast()
  const familyId = authMember?.family_id
  const { members } = useMembers(familyId)
  const { uploadDocument } = useDocuments(id)
  const { memberIds, saveNumber } = useMemberIds(familyId)

  const targetMember = members.find(m => m.id === id)
  const canUpload = isAdmin || id === authMember?.id
  const savedNumbers = useMemo(
    () => new Map(memberIds.filter(r => r.member_id === id && r.id_number).map(r => [r.category_id, r.id_number])),
    [memberIds, id]
  )

  if (!canUpload) {
    return (
      <div className="p-6 max-w-sm mx-auto text-center py-20">
        <h1 className="text-lg font-bold text-text-primary mb-1.5">That's not your profile</h1>
        <p className="text-sm text-text-muted mb-6">
          You can add IDs to your own profile. Ask a family admin to add them for someone else.
        </p>
        <button
          onClick={() => navigate(`/member/${authMember?.id}/upload`)}
          className="min-h-11 px-5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors active:scale-[0.98]"
        >
          Add to my profile instead
        </button>
      </div>
    )
  }

  async function handleSubmit({ categoryId, file, label, notes, idNumber }) {
    if (file) await uploadDocument({ memberId: id, categoryId, label, file, notes, familyId })
    if (idNumber !== undefined) await saveNumber({ memberId: id, categoryId, idNumber })
    toast.success(file && idNumber ? 'Saved file and number' : file ? `Saved "${label}"` : 'Saved number')
    // Back to where the person came from (home or their page) with the result in view.
    navigate(-1)
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-lg mx-auto">
      <button onClick={() => navigate(-1)} className="text-sm text-text-muted hover:text-primary-600 min-h-10 mb-2">‹ Back</button>

      <h1 className="text-xl font-bold text-text-primary mb-1">Add an ID</h1>
      {targetMember && (
        <div className="flex items-center gap-2 mb-5">
          <span className="scale-75 -m-1.5"><Avatar member={targetMember} /></span>
          <p className="text-sm text-text-muted">For {targetMember.name} · {targetMember.relationship}</p>
        </div>
      )}

      <div className="bg-surface-card rounded-2xl border border-stone-200/60 p-4 sm:p-6">
        <UploadForm
          familyId={familyId}
          presetCategoryId={params.get('category') || ''}
          savedNumbers={savedNumbers}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  )
}
