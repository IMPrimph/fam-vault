import { getAvatarGradient, getInitials } from '../../utils/avatar'
import { otherFilesRecord } from '../../lib/idRecords'
import IdRow from './IdRow'
import { ChevronRightIcon, PlusIcon } from './icons'

export function Avatar({ member, size = 'md' }) {
  const cls = size === 'lg' ? 'w-14 h-14 rounded-2xl text-lg' : 'w-10 h-10 rounded-xl text-sm'
  if (member.avatar_url) return <img src={member.avatar_url} alt="" className={`${cls} object-cover shrink-0`} />
  return (
    <div className={`${cls} bg-gradient-to-br ${getAvatarGradient(member.name)} flex items-center justify-center text-white font-semibold shadow-sm shrink-0`}>
      {getInitials(member.name)}
    </div>
  )
}

/**
 * A person and their IDs, the unit the home screen is built from.
 * `onOpenRecord(record, { edit })` opens the ID sheet, optionally straight
 * into number editing.
 */
export default function PersonCard({ person, isSelf, canEdit, onOpenPerson, onOpenRecord, onAdd }) {
  const { member, records } = person
  const otherRecord = otherFilesRecord(person)

  return (
    <section className="bg-surface-card rounded-2xl border border-stone-200/60 overflow-hidden" aria-label={member.name}>
      <button
        type="button"
        onClick={onOpenPerson}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover transition-colors"
      >
        <Avatar member={member} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-semibold text-text-primary truncate">{member.name}</span>
            {isSelf && <span className="text-[11px] font-semibold text-primary-700 bg-primary-50 px-1.5 py-0.5 rounded-md">You</span>}
          </span>
          <span className="block text-xs text-text-muted truncate">{member.relationship}</span>
        </span>
        <ChevronRightIcon className="w-4 h-4 text-text-muted" />
      </button>

      {records.length || otherRecord ? (
        <div className="divide-y divide-stone-100 border-t border-stone-100">
          {records.map(r => (
            <IdRow
              key={r.key}
              record={r}
              memberName={member.name}
              canEdit={canEdit}
              onOpen={() => onOpenRecord(r)}
              onAddNumber={() => onOpenRecord(r, { edit: true })}
            />
          ))}
          {otherRecord && (
            <IdRow record={otherRecord} memberName={member.name} canEdit={false} onOpen={() => onOpenRecord(otherRecord)} />
          )}
        </div>
      ) : (
        <div className="border-t border-stone-100 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-text-muted">No IDs yet</p>
          {canEdit && (
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex items-center gap-1 min-h-11 px-3 rounded-xl text-sm font-medium text-primary-600 hover:bg-primary-50 transition-colors"
            >
              <PlusIcon className="w-3.5 h-3.5" /> Add ID
            </button>
          )}
        </div>
      )}
    </section>
  )
}
