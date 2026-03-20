import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useNavigate } from 'react-router-dom'
import { getAvatarGradient, getInitials } from '../utils/avatar'

function MemberNode({ data }) {
  const { member, docCount } = data
  const navigate = useNavigate()
  const gradient = getAvatarGradient(member.name)
  const initials = getInitials(member.name)

  return (
    <div
      onClick={() => navigate(`/member/${member.id}`)}
      className="relative bg-surface-card rounded-2xl border border-stone-200/60 px-4 py-3 cursor-pointer hover:shadow-lg hover:shadow-stone-200/50 hover:border-primary-200 transition-all duration-200 w-48 group"
    >
      <Handle type="target" position={Position.Top} className="!bg-stone-300 !w-2 !h-2 !border-0" />
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-xs font-semibold shadow-sm shrink-0`}>
          {member.avatar_url
            ? <img src={member.avatar_url} className="w-9 h-9 rounded-lg object-cover" alt="" />
            : initials
          }
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-text-primary text-sm truncate group-hover:text-primary-700 transition-colors">{member.name}</p>
          <p className="text-xs text-text-muted">{member.relationship}</p>
        </div>
      </div>
      {docCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 bg-primary-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
          {docCount}
        </span>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-stone-300 !w-2 !h-2 !border-0" />
    </div>
  )
}

export default memo(MemberNode)
