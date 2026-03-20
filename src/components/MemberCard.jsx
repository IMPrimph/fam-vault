import { useNavigate } from 'react-router-dom'
import { getAvatarGradient, getInitials } from '../utils/avatar'

export default function MemberCard({ member }) {
  const navigate = useNavigate()
  const gradient = getAvatarGradient(member.name)
  const initials = getInitials(member.name)
  const docCount = member.documents?.length || 0

  return (
    <button
      onClick={() => navigate(`/member/${member.id}`)}
      className="w-full text-left bg-surface-card rounded-2xl border border-stone-200/60 p-4 hover:shadow-lg hover:shadow-stone-200/50 hover:border-stone-300/60 transition-all duration-200 group active:scale-[0.98]"
    >
      <div className="flex items-center gap-3.5">
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-sm font-semibold shadow-sm shrink-0`}>
          {member.avatar_url
            ? <img src={member.avatar_url} className="w-11 h-11 rounded-xl object-cover" alt="" />
            : initials
          }
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-text-primary text-[15px] truncate group-hover:text-primary-700 transition-colors">{member.name}</p>
          <p className="text-sm text-text-muted">{member.relationship}</p>
        </div>
        <div className="flex items-center gap-1.5 text-text-muted">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
          <span className="text-xs font-medium">{docCount}</span>
        </div>
      </div>
    </button>
  )
}
