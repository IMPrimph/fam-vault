import { useState } from 'react'
import { useInvites } from '../hooks/useInvites'
import { useMembers } from '../hooks/useMembers'
import { useToast } from '../context/ToastContext'
import { useDialog } from '../context/DialogContext'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function InviteManager({ familyId }) {
  const { invites, createInvite, revokeInvite } = useInvites(familyId)
  const { members } = useMembers(familyId)
  const toast = useToast()
  const { confirm } = useDialog()
  const [selectedMember, setSelectedMember] = useState('')
  const [email, setEmail] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  const invitableMembers = members.filter(m => {
    if (m.user_id) return false
    const hasActiveInvite = invites.some(i => i.member_id === m.id && i.status === 'pending')
    return !hasActiveInvite
  })

  async function handleCreate() {
    if (!selectedMember) return
    const trimmed = email.trim()
    if (!trimmed || !EMAIL_RE.test(trimmed)) {
      setError('Enter the email they will sign in with — the invite only works for that address.')
      return
    }
    setError('')
    setCreating(true)
    try {
      await createInvite({ memberId: selectedMember, email: trimmed })
      setSelectedMember('')
      setEmail('')
      toast.success('Invite link created — copy it and send it to them')
    } catch (err) {
      toast.error(err.message || 'Could not create the invite')
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(inv) {
    const ok = await confirm({
      title: 'Revoke this invite?',
      message: `The link sent to ${inv.members?.name || 'this person'} will stop working. You can create a new one afterwards.`,
      confirmLabel: 'Revoke',
      destructive: true,
    })
    if (!ok) return
    try {
      await revokeInvite(inv.id)
      toast.success('Invite revoked')
    } catch (err) {
      toast.error(err.message || 'Could not revoke the invite')
    }
  }

  async function copyLink(token) {
    const url = `${window.location.origin}/invite/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(token)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error('Could not copy — select and copy the link manually')
    }
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-text-primary mb-1">Invite Links</h2>
        <p className="text-sm text-text-muted">Generate unique links to invite family members. Each link is tied to a specific person.</p>
      </div>

      {/* Generate new invite */}
      {invitableMembers.length > 0 && (
        <div className="space-y-2 mb-5">
          <select
            value={selectedMember}
            onChange={e => setSelectedMember(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-surface border border-stone-300 rounded-xl text-sm text-text-primary focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all"
          >
            <option value="">Select member to invite...</option>
            {invitableMembers.map(m => (
              <option key={m.id} value={m.id}>{m.name} ({m.relationship})</option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); if (error) setError('') }}
              placeholder="Email address for this invite"
              className="flex-1 px-3.5 py-2.5 bg-surface border border-stone-300 rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 outline-none transition-all"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !selectedMember || !email.trim()}
              className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors active:scale-[0.98]"
            >
              {creating ? 'Creating...' : 'Generate'}
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <p className="text-[11px] text-text-muted">Invites expire in 7 days and can only be accepted by someone signing in with the email above.</p>
        </div>
      )}

      {invitableMembers.length === 0 && invites.length === 0 && (
        <p className="text-sm text-text-muted text-center py-4">All members have been invited or joined.</p>
      )}

      {/* Existing invites */}
      <div className="space-y-2">
        {invites.map(inv => (
          <div key={inv.id} className="flex items-center justify-between py-3 px-3 rounded-xl bg-surface-hover/50">
            <div>
              <p className="text-sm font-medium text-text-primary">
                {inv.members?.name} <span className="text-text-muted font-normal">({inv.members?.relationship})</span>
              </p>
              <p className={`text-xs mt-0.5 font-medium ${
                inv.status === 'accepted' ? 'text-emerald-600' :
                inv.status === 'revoked' ? 'text-red-500' : 'text-amber-600'
              }`}>
                {inv.status === 'accepted' ? 'Joined' : inv.status === 'revoked' ? 'Revoked' : 'Pending'}
              </p>
            </div>
            <div className="flex gap-1.5">
              {inv.status === 'pending' && (
                <>
                  <button
                    onClick={() => copyLink(inv.token)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 font-medium transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" /></svg>
                    {copiedId === inv.token ? 'Copied!' : 'Copy Link'}
                  </button>
                  <button
                    onClick={() => handleRevoke(inv)}
                    className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg font-medium transition-colors"
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
