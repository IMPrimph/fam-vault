import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useMembers } from '../hooks/useMembers'
import FamilyTree from '../components/FamilyTree'
import MemberGrid from '../components/MemberGrid'
import AddMemberForm from '../components/AddMemberForm'

export default function FamilyPage() {
  const { member, isAdmin } = useAuth()
  const { members, loading, addMember } = useMembers(member?.family_id)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showTree, setShowTree] = useState(false)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-7 w-7 border-2 border-primary-600 border-t-transparent" />
    </div>
  )

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Family</h1>
          <p className="text-sm text-text-muted mt-0.5">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTree(!showTree)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              showTree ? 'bg-primary-50 text-primary-700' : 'bg-stone-100 text-text-secondary hover:bg-stone-200'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" /></svg>
            Family Tree
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors shadow-sm shadow-primary-200 active:scale-[0.98]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Add Member
            </button>
          )}
        </div>
      </div>

      {/* Family tree (collapsed by default) */}
      {showTree && (
        <div className="bg-surface-card rounded-2xl border border-stone-200/60 overflow-hidden">
          <FamilyTree members={members} />
        </div>
      )}

      {/* Members */}
      <MemberGrid members={members} />

      {showAddForm && (
        <AddMemberForm members={members} onSubmit={addMember} onClose={() => setShowAddForm(false)} />
      )}
    </div>
  )
}
