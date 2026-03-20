import { useState } from 'react'
import { useInvites } from '../hooks/useInvites'

export default function InviteManager({ familyId, members }) {
  const { invites, createInvite, revokeInvite } = useInvites(familyId)
  const [selectedMember, setSelectedMember] = useState('')
  const [copiedId, setCopiedId] = useState(null)

  const invitableMembers = members.filter(m => {
    if (m.user_id) return false
    const hasActiveInvite = invites.some(i => i.member_id === m.id && i.status === 'pending')
    return !hasActiveInvite
  })

  async function handleCreate() {
    if (!selectedMember) return
    await createInvite(selectedMember)
    setSelectedMember('')
  }

  function copyLink(token) {
    const url = `${window.location.origin}/invite/${token}`
    navigator.clipboard.writeText(url)
    setCopiedId(token)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Invite Links</h3>

      {invitableMembers.length > 0 && (
        <div className="flex gap-2">
          <select
            value={selectedMember}
            onChange={e => setSelectedMember(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="">Select member to invite...</option>
            {invitableMembers.map(m => (
              <option key={m.id} value={m.id}>{m.name} ({m.relationship})</option>
            ))}
          </select>
          <button
            onClick={handleCreate}
            disabled={!selectedMember}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            Generate Link
          </button>
        </div>
      )}

      <div className="space-y-2">
        {invites.map(inv => (
          <div key={inv.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
            <div>
              <p className="font-medium text-sm text-gray-900">
                {inv.members?.name} ({inv.members?.relationship})
              </p>
              <p className={`text-xs ${
                inv.status === 'accepted' ? 'text-green-600' :
                inv.status === 'revoked' ? 'text-red-500' : 'text-yellow-600'
              }`}>
                {inv.status}
              </p>
            </div>
            <div className="flex gap-2">
              {inv.status === 'pending' && (
                <>
                  <button
                    onClick={() => copyLink(inv.token)}
                    className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 font-medium"
                  >
                    {copiedId === inv.token ? 'Copied!' : 'Copy Link'}
                  </button>
                  <button
                    onClick={() => revokeInvite(inv.id)}
                    className="text-xs px-3 py-1.5 bg-red-50 text-red-700 rounded-md hover:bg-red-100 font-medium"
                  >
                    Revoke
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
