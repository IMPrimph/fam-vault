import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { lookupInvite, acceptInvite } from '../hooks/useInvites'
import LoginForm from '../components/LoginForm'

function StatusScreen({ icon, title, description, action }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary-50 via-white to-purple-50">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto mb-4">
          {icon}
        </div>
        <h1 className="text-xl font-bold text-text-primary mb-2">{title}</h1>
        <p className="text-sm text-text-muted">{description}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  )
}

export default function InvitePage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { session, member, fetchMember } = useAuth()
  const [invite, setInvite] = useState(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    lookupInvite(token)
      .then(data => {
        if (!data || !data.family_name) setError('Invalid invite link.')
        else setInvite(data)
      })
      .catch(() => setError('Invalid invite link.'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleAccept() {
    setAccepting(true)
    setError('')
    try {
      await acceptInvite(token)
      await fetchMember()
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setAccepting(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="animate-spin rounded-full h-7 w-7 border-2 border-primary-600 border-t-transparent" role="status"><span className="sr-only">Loading...</span></div>
    </div>
  )

  if (error && !invite) return (
    <StatusScreen
      icon={<svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>}
      title="Invalid Invite"
      description={error}
    />
  )

  if (invite?.status === 'accepted') return (
    <StatusScreen
      icon={<svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
      title="Invite Already Used"
      description="This invite has already been accepted."
      action={<a href="/" className="text-sm text-primary-600 hover:text-primary-700 font-medium">Go to login</a>}
    />
  )

  if (invite?.status === 'revoked' || (invite?.expires_at && new Date(invite.expires_at) < new Date())) return (
    <StatusScreen
      icon={<svg className="w-7 h-7 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
      title="Invite Expired"
      description="This invite is no longer valid. Contact your family admin."
    />
  )

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary-50 via-white to-purple-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-200 mb-4">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" /></svg>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">You're Invited!</h1>
          <p className="text-text-secondary mt-2">
            Join <strong className="text-text-primary">{invite.family_name}</strong> as <strong className="text-text-primary">{invite.relationship}</strong>
          </p>
        </div>

        <div className="bg-surface-card rounded-2xl shadow-xl shadow-stone-200/50 border border-stone-200/60 p-7">
          {!session ? (
            <div>
              <p className="text-sm text-text-muted mb-5 text-center">Sign in with your email to accept this invite.</p>
              <LoginForm />
            </div>
          ) : member ? (
            <div className="text-center py-2">
              <p className="text-text-secondary">You already belong to a family.</p>
              <button onClick={() => navigate('/dashboard')} className="text-sm text-primary-600 hover:text-primary-700 font-medium mt-3">
                Go to dashboard
              </button>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-text-muted mb-5">You're signed in. Click below to join the family.</p>
              {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg mb-4">{error}</p>}
              <button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl text-sm font-semibold hover:from-primary-700 hover:to-primary-800 disabled:opacity-50 transition-all shadow-md shadow-primary-200 active:scale-[0.98]"
              >
                {accepting ? 'Joining...' : 'Accept Invite & Join'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
