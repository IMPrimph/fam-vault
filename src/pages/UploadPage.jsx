import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useDocuments } from '../hooks/useDocuments'
import { useMembers } from '../hooks/useMembers'
import { getAvatarGradient, getInitials } from '../utils/avatar'
import UploadForm from '../components/UploadForm'

export default function UploadPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { member: authMember, isAdmin } = useAuth()
  const toast = useToast()
  const { members } = useMembers(authMember?.family_id)
  const { uploadDocument } = useDocuments(id)

  const targetMember = members.find(m => m.id === id)
  const canUpload = isAdmin || targetMember?.user_id === authMember?.user_id
  const gradient = targetMember ? getAvatarGradient(targetMember.name) : ''
  const initials = targetMember ? getInitials(targetMember.name) : ''

  if (!canUpload) {
    return (
      <div className="p-6 max-w-sm mx-auto text-center py-20">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
        </div>
        <h1 className="text-lg font-bold text-text-primary mb-1.5">That's not your profile</h1>
        <p className="text-sm text-text-muted mb-6">
          You can add documents to your own profile. Ask a family admin to upload on someone else's behalf.
        </p>
        <button
          onClick={() => navigate(`/member/${authMember?.id}/upload`)}
          className="px-5 py-3 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors active:scale-[0.98]"
        >
          Add to my profile instead
        </button>
      </div>
    )
  }

  async function handleUpload(data) {
    const doc = await uploadDocument(data)
    toast.success(`Saved "${doc?.label || data.label}"`)
    navigate(`/member/${id}`)
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-lg mx-auto">
      <nav className="flex items-center gap-1.5 text-xs text-text-muted mb-5">
        <button onClick={() => navigate('/dashboard')} className="hover:text-primary-600 transition-colors">Documents</button>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
        <button onClick={() => navigate(`/member/${id}`)} className="hover:text-primary-600 transition-colors">{targetMember?.name || 'Member'}</button>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
        <span className="text-text-secondary font-medium">Upload</span>
      </nav>

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
