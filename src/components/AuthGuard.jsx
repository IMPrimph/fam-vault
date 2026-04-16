import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AuthGuard({ children }) {
  const { session, loading } = useAuth()

  if (loading) return <div className="flex items-center justify-center h-screen bg-surface">
    <div className="animate-spin rounded-full h-7 w-7 border-2 border-primary-600 border-t-transparent" />
  </div>

  if (!session) return <Navigate to="/" replace />

  return children
}
