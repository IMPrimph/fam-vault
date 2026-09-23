import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useMembers } from '../hooks/useMembers'
import { useAllDocuments } from '../hooks/useAllDocuments'
import { useMemberIds } from '../hooks/useMemberIds'
import { useCategories } from '../hooks/useCategories'
import { buildPeople, searchPeople, findRecord, scanTargets } from '../lib/idRecords'
import PersonCard, { Avatar } from '../components/ids/PersonCard'
import IdRow from '../components/ids/IdRow'
import IdSheet from '../components/ids/IdSheet'
import { SearchIcon, PlusIcon, ScanIcon } from '../components/ids/icons'
import StorageWarning from '../components/StorageWarning'

/**
 * Home: people and their IDs, each number one tap from the clipboard.
 *
 * Built for the common trip into the app, "I need Dad's PAN for this form",
 * so the path is search or scroll → copy, with files one tap further in.
 */
export default function DashboardPage() {
  const navigate = useNavigate()
  const { member: me, isAdmin } = useAuth()
  const familyId = me?.family_id
  const { members, loading: membersLoading } = useMembers(familyId)
  const { documents, loading: docsLoading } = useAllDocuments(familyId)
  const { memberIds } = useMemberIds(familyId)
  const { categories } = useCategories(familyId)

  const [search, setSearch] = useState('')
  const [focusPersonId, setFocusPersonId] = useState(null)
  const [open, setOpen] = useState(null) // { key, edit }

  const people = useMemo(
    () => buildPeople({ members, documents, memberIds, categories, selfMemberId: me?.id }),
    [members, documents, memberIds, categories, me?.id]
  )
  const results = useMemo(() => searchPeople(people, search), [people, search])
  const searching = search.trim().length > 0
  const unscannedCount = useMemo(
    () => scanTargets(people, id => isAdmin || id === me?.id).length,
    [people, isAdmin, me?.id]
  )

  const canEdit = (memberId) => isAdmin || memberId === me?.id

  // Resolve the open sheet against fresh data every render, so a saved
  // number or a deleted file shows up without closing the sheet.
  const openTarget = open ? findRecord(people, open.key) : null

  const visiblePeople = focusPersonId ? people.filter(p => p.member.id === focusPersonId) : people

  if ((membersLoading || docsLoading) && !members.length) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-7 w-7 border-2 border-primary-600 border-t-transparent" role="status" aria-label="Loading" />
    </div>
  )

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto">
      <StorageWarning familyId={familyId} />

      {/* Search stays reachable while scrolling a long family on a phone. */}
      <div className="sticky top-[61px] md:top-0 z-20 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 py-2 bg-surface/90 backdrop-blur-md">
        <div className="relative max-w-2xl">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search people, IDs and numbers"
            placeholder="Search name, ID or number…"
            className="w-full pl-12 pr-4 py-3 bg-surface-card border border-stone-200 rounded-2xl text-base text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 outline-none transition-all shadow-sm"
          />
        </div>
      </div>

      {searching ? (
        <SearchResults results={results} onOpen={(key, edit) => setOpen({ key, edit })} canEdit={canEdit} onClear={() => setSearch('')} />
      ) : (
        <>
        {unscannedCount > 0 && (
          <button
            type="button"
            onClick={() => navigate('/settings?tab=scan')}
            className="mt-3 w-full max-w-2xl flex items-center gap-3 text-left bg-primary-50 hover:bg-primary-100 rounded-2xl px-4 py-3 transition-colors"
          >
            <ScanIcon className="w-5 h-5 text-primary-600 shrink-0" />
            <span className="flex-1 text-sm text-text-secondary">
              <span className="font-semibold text-primary-700">{unscannedCount} {unscannedCount === 1 ? 'ID has' : 'IDs have'} a card but no number.</span>{' '}
              Read them from the files
            </span>
            <span className="text-primary-600" aria-hidden="true">›</span>
          </button>
        )}
        <div className="mt-3 lg:grid lg:grid-cols-[13rem_1fr] lg:gap-6 lg:items-start">
          {/* Desktop: pick a person to focus on. Phones just scroll. */}
          <nav className="hidden lg:block sticky top-20 space-y-0.5" aria-label="People">
            <PersonNavButton active={!focusPersonId} onClick={() => setFocusPersonId(null)} label="Everyone" count={people.length} />
            {people.map(p => (
              <PersonNavButton
                key={p.member.id}
                active={focusPersonId === p.member.id}
                onClick={() => setFocusPersonId(p.member.id)}
                member={p.member}
                label={p.member.id === me?.id ? `${p.member.name} (you)` : p.member.name}
                count={p.records.length}
              />
            ))}
          </nav>

          <div className="grid gap-3 xl:grid-cols-2 xl:items-start">
            {visiblePeople.map(p => (
              <PersonCard
                key={p.member.id}
                person={p}
                isSelf={p.member.id === me?.id}
                canEdit={canEdit(p.member.id)}
                onOpenPerson={() => navigate(`/member/${p.member.id}`)}
                onOpenRecord={(r, opts) => setOpen({ key: r.key, edit: !!opts?.edit })}
                onAdd={() => navigate(`/member/${p.member.id}/upload`)}
              />
            ))}
          </div>
        </div>
        </>
      )}

      <div className="h-24 md:h-8" />
      <AddButton members={members} isAdmin={isAdmin} ownMemberId={me?.id} focusPersonId={focusPersonId} />

      {openTarget && (
        <IdSheet
          member={openTarget.member}
          record={openTarget.record}
          startEditing={open.edit}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  )
}

function PersonNavButton({ active, onClick, member, label, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm text-left transition-colors ${
        active ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-text-secondary hover:bg-surface-hover'
      }`}
    >
      {member ? (
        <span className="scale-75 -m-1.5"><Avatar member={member} /></span>
      ) : (
        <span className="w-7 h-7 rounded-lg bg-stone-200 flex items-center justify-center text-[11px] font-bold text-text-secondary">All</span>
      )}
      <span className="flex-1 truncate">{label}</span>
      <span className="text-xs text-text-muted">{count}</span>
    </button>
  )
}

function SearchResults({ results, onOpen, canEdit, onClear }) {
  if (!results.length) {
    return (
      <div className="text-center py-16">
        <p className="text-text-secondary font-medium">Nothing matches that</p>
        <p className="text-sm text-text-muted mt-1">Try a name, an ID type like "PAN", or part of a number.</p>
        <button onClick={onClear} className="mt-4 min-h-11 px-4 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors">
          Clear search
        </button>
      </div>
    )
  }
  return (
    <div className="mt-3 max-w-2xl">
      <p className="text-sm text-text-muted mb-2">{results.length} {results.length === 1 ? 'result' : 'results'}</p>
      <div className="bg-surface-card rounded-2xl border border-stone-200/60 divide-y divide-stone-100 overflow-hidden">
        {results.map(({ member, record }) => (
          <IdRow
            key={record.key}
            record={record}
            memberName={member.name}
            personLabel={member.name}
            canEdit={canEdit(member.id)}
            onOpen={() => onOpen(record.key, false)}
            onAddNumber={() => onOpen(record.key, true)}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Add shortcut. Members may only add to their own profile, so for them it
 * goes straight there; admins pick whose ID it is first.
 */
function AddButton({ members, isAdmin, ownMemberId, focusPersonId }) {
  const navigate = useNavigate()
  const [picking, setPicking] = useState(false)

  if (!isAdmin && !ownMemberId) return null

  function handleClick() {
    if (!isAdmin) return navigate(`/member/${ownMemberId}/upload`)
    if (focusPersonId) return navigate(`/member/${focusPersonId}/upload`)
    if (members.length === 1) return navigate(`/member/${members[0].id}/upload`)
    setPicking(true)
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="fixed bottom-24 md:bottom-6 right-4 md:right-8 h-14 pl-4 pr-5 bg-primary-600 text-white rounded-2xl shadow-lg shadow-primary-300/40 hover:bg-primary-700 flex items-center gap-2 transition-all active:scale-95 z-20 font-semibold"
        aria-label={isAdmin ? 'Add an ID or document' : 'Add one of your IDs'}
      >
        <PlusIcon className="w-6 h-6" />
        <span className="text-sm">Add</span>
      </button>

      {picking && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center md:p-4" onClick={() => setPicking(false)}>
          <div className="w-full md:max-w-sm bg-surface-card rounded-t-2xl md:rounded-2xl shadow-2xl border border-stone-200/60 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-stone-100">
              <h3 className="text-base font-semibold text-text-primary">Whose ID is this?</h3>
            </div>
            <div className="p-2 max-h-[60vh] overflow-auto pb-6 md:pb-2">
              {members.map(m => (
                <button
                  key={m.id}
                  onClick={() => { setPicking(false); navigate(`/member/${m.id}/upload`) }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-surface-hover transition-colors text-left"
                >
                  <Avatar member={m} />
                  <span>
                    <span className="block text-sm font-medium text-text-primary">{m.name}</span>
                    <span className="block text-xs text-text-muted">{m.relationship}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
