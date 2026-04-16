import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useMembers } from '../hooks/useMembers'
import { getAvatarGradient, getInitials } from '../utils/avatar'
import EditConnections from './EditConnections'

export default function MemberCard({ member }) {
  const navigate = useNavigate()
  const { member: authMember, isAdmin } = useAuth()
  const { members, updateMember } = useMembers(authMember?.family_id)
  const [editing, setEditing] = useState(false)
  const gradient = getAvatarGradient(member.name)
  const initials = getInitials(member.name)
  const docCount = member.documents?.length || 0

  const go = () => navigate(`/member/${member.id}`)

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={go}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go() } }}
        className="w-full text-left bg-surface-card rounded-2xl border border-stone-200/60 p-4 hover:shadow-lg hover:shadow-stone-200/50 hover:border-stone-300/60 transition-all duration-200 group active:scale-[0.98] cursor-pointer"
      >
        <div className="flex items-center gap-3.5">
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-sm font-semibold shadow-sm shrink-0`}>
            {member.avatar_url
              ? <img src={member.avatar_url} className="w-11 h-11 rounded-xl object-cover" alt="" />
              : initials
            }
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-text-primary text-[15px] break-words group-hover:text-primary-700 transition-colors">{member.name}</p>
            <p className="text-sm text-text-muted break-words">{member.relationship}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isAdmin && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setEditing(true) }}
                aria-label="Edit connections"
                title="Edit connections"
                className="p-1.5 rounded-lg text-text-muted hover:text-primary-600 hover:bg-primary-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" /></svg>
              </button>
            )}
            <div className="flex items-center gap-1.5 text-text-muted pr-0.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
              <span className="text-xs font-medium">{docCount}</span>
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <EditConnections
          member={member}
          members={members}
          onSubmit={updateMember}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  )
}
