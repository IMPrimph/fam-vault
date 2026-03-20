import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AuthGuard from './components/AuthGuard'
import AdminGuard from './components/AdminGuard'
import Layout from './components/Layout'
import CreateFamily from './components/CreateFamily'
import LandingPage from './pages/LandingPage'
import DashboardPage from './pages/DashboardPage'
import MemberPage from './pages/MemberPage'
import UploadPage from './pages/UploadPage'
import SettingsPage from './pages/SettingsPage'
import FamilyPage from './pages/FamilyPage'
import InvitePage from './pages/InvitePage'
import InstallPrompt from './components/InstallPrompt'

function AppRoutes() {
  const { session, member, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="flex items-center justify-center h-screen bg-surface">
    <div className="animate-spin rounded-full h-7 w-7 border-2 border-primary-600 border-t-transparent" />
  </div>

  // Logged in but no family yet — show create family form
  // EXCEPT when on an invite page (invitees need to accept before they have a member record)
  const isInvitePath = location.pathname.startsWith('/invite/')
  if (session && !loading && !member && !isInvitePath) {
    return <CreateFamily />
  }

  return (
    <Routes>
      <Route path="/" element={session ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
      <Route path="/invite/:token" element={<InvitePage />} />
      <Route element={<AuthGuard><Layout /></AuthGuard>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/family" element={<FamilyPage />} />
        <Route path="/member/:id" element={<MemberPage />} />
        <Route path="/member/:id/upload" element={<UploadPage />} />
        <Route path="/settings" element={<AdminGuard><SettingsPage /></AdminGuard>} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <InstallPrompt />
      </AuthProvider>
    </BrowserRouter>
  )
}
