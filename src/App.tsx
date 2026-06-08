import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { LayoutProvider } from './contexts/LayoutContext'
import Layout from './components/Layout/Layout'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import InboxPage from './pages/InboxPage'
import ProfilePage from './pages/ProfilePage'
import UserProfilePage from './pages/UserProfilePage'
import MessageDetailPage from './pages/MessageDetailPage'
import HelpCenterPage from './pages/HelpCenterPage'
import NotificationsPage from './pages/NotificationsPage'
import SettingsPage from './pages/SettingsPage'
import PostDetailPage from './pages/PostDetailPage'
import CartPage from './pages/CartPage'
import OnboardingFlow from './components/Onboarding/OnboardingFlow'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading, profile, isExploreMode } = useAuth()

  if (loading && !isExploreMode) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
    </div>
  )

  if (!user && !isExploreMode) return <Navigate to="/auth" replace />

  return (
    <>
      {children}
      {/* Show onboarding overlay as soon as profile loads with onboarding_completed = false */}
      {profile !== null && profile.onboarding_completed === false && (
        <OnboardingFlow />
      )}
    </>
  )
}

export default function App() {
  return (
    <LayoutProvider>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route path="/"              element={<HomePage />} />
          <Route path="/u/:username"   element={<UserProfilePage />} />
          <Route path="/inbox"         element={<InboxPage />} />
          <Route path="/inbox/:id"     element={<MessageDetailPage />} />
          <Route path="/profile"       element={<ProfilePage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/help"          element={<HelpCenterPage />} />
          <Route path="/settings"      element={<SettingsPage />} />
          <Route path="/post/:postId"  element={<PostDetailPage />} />
          <Route path="/cart"          element={<CartPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </LayoutProvider>
  )
}
