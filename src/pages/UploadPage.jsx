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
