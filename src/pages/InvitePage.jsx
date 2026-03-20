import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { lookupInvite, acceptInvite } from '../hooks/useInvites'
import LoginForm from '../components/LoginForm'

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
        if (!data || !data.family_name) {
          setError('Invalid invite link.')
        } else {
          setInvite(data)
        }
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

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>

  if (error && !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invite</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  if (invite?.status === 'accepted') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invite Already Used</h1>
          <p className="text-gray-600 mb-4">This invite has already been accepted.</p>
          <a href="/" className="text-blue-600 hover:underline">Go to login</a>
        </div>
      </div>
    )
  }

  if (invite?.status === 'revoked' || (invite?.expires_at && new Date(invite.expires_at) < new Date())) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invite Expired</h1>
          <p className="text-gray-600">This invite is no longer valid. Contact your family admin.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm p-8 text-center space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">You're Invited!</h1>
          <p className="text-gray-600 mt-2">
            Join <strong>{invite.family_name}</strong> as <strong>{invite.relationship}</strong>
          </p>
        </div>

        {!session ? (
          <div>
            <p className="text-sm text-gray-500 mb-4">Sign in with your email to accept this invite.</p>
            <LoginForm />
          </div>
        ) : member ? (
          <div>
            <p className="text-gray-600">You already belong to a family.</p>
            <button onClick={() => navigate('/dashboard')} className="text-blue-600 hover:underline mt-2">
              Go to dashboard
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-500 mb-4">You're signed in. Click below to join the family.</p>
            {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {accepting ? 'Joining...' : 'Accept Invite'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
