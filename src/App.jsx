import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { ErrorBoundary } from 'react-error-boundary'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { DialogProvider } from './context/DialogContext'
import AuthGuard from './components/AuthGuard'
import Layout from './components/Layout'
import CreateFamily from './components/CreateFamily'
import InstallPrompt from './components/InstallPrompt'
import UpdatePrompt from './components/UpdatePrompt'

// Lazy-load all page components for code splitting
const LandingPage = lazy(() => import('./pages/LandingPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const MemberPage = lazy(() => import('./pages/MemberPage'))
const UploadPage = lazy(() => import('./pages/UploadPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const FamilyPage = lazy(() => import('./pages/FamilyPage'))
const InvitePage = lazy(() => import('./pages/InvitePage'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-7 w-7 border-2 border-primary-600 border-t-transparent" />
    </div>
  )
}

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-surface">
      <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
      </div>
      <h1 className="text-xl font-bold text-text-primary mb-2">Something went wrong</h1>
      <p className="text-sm text-text-muted max-w-sm mb-6">{error.message}</p>
      <button
        onClick={resetErrorBoundary}
        className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors active:scale-[0.98]"
      >
        Try Again
      </button>
    </div>
  )
}

function AppRoutes() {
  const { session, member, loading, fetchError, fetchMember } = useAuth()
  const location = useLocation()

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-surface">
      <div className="animate-spin rounded-full h-7 w-7 border-2 border-primary-600 border-t-transparent" role="status" aria-label="Loading">
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  )

  // Member fetch failed AND no cached profile available. Show retry screen.
  if (session && !loading && fetchError && !member) {
    const isOffline = fetchError === 'offline' || !navigator.onLine
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-surface">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
        </div>
        <h1 className="text-xl font-bold text-text-primary mb-2">{isOffline ? "You're offline" : 'Connection Error'}</h1>
        <p className="text-sm text-text-muted max-w-sm mb-6">
          {isOffline
            ? "Sign in needs an internet connection the first time. Reconnect and try again."
            : "Couldn't load your profile. Check your internet connection and try again."}
        </p>
        <button onClick={() => fetchMember(session.user.id)} className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors active:scale-[0.98]">
          Retry
        </button>
      </div>
    )
  }

  const isInvitePath = location.pathname.startsWith('/invite/')
  if (session && !loading && !member && !isInvitePath) {
    return <CreateFamily />
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={session ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
        <Route path="/invite/:token" element={<InvitePage />} />
        <Route element={<AuthGuard><Layout /></AuthGuard>}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/family" element={<FamilyPage />} />
          <Route path="/member/:id" element={<MemberPage />} />
          <Route path="/member/:id/upload" element={<UploadPage />} />
          {/* Settings is reachable by every member; individual tabs gate on role. */}
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <DialogProvider>
              <AppRoutes />
              <InstallPrompt />
              <UpdatePrompt />
            </DialogProvider>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
