import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useDocuments } from '../hooks/useDocuments'
import { useMembers } from '../hooks/useMembers'
import { getAvatarGradient, getInitials } from '../utils/avatar'
import UploadForm from '../components/UploadForm'

export default function UploadPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { member: authMember, isAdmin } = useAuth()
  const { members } = useMembers(authMember?.family_id)
  const { uploadDocument } = useDocuments(id)

  const targetMember = members.find(m => m.id === id)
  const canUpload = isAdmin || targetMember?.user_id === authMember?.user_id
  const gradient = targetMember ? getAvatarGradient(targetMember.name) : ''
  const initials = targetMember ? getInitials(targetMember.name) : ''

  if (!canUpload) {
    return <div className="p-6 text-red-500">You can only upload documents for your own profile.</div>
  }

  async function handleUpload(data) {
    await uploadDocument(data)
    navigate(`/member/${id}`)
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-lg mx-auto">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary-600 transition-colors mb-5">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
        Back
      </button>

      <h1 className="text-xl font-bold text-text-primary mb-1">Upload Document</h1>
      {targetMember && (
        <div className="flex items-center gap-2 mb-6">
          <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-[10px] font-semibold`}>
            {initials}
          </div>
          <p className="text-sm text-text-muted">For {targetMember.name} ({targetMember.relationship})</p>
        </div>
      )}

      <div className="bg-surface-card rounded-2xl border border-stone-200/60 p-6">
        <UploadForm familyId={authMember?.family_id} memberId={id} onUpload={handleUpload} />
      </div>
    </div>
  )
}
