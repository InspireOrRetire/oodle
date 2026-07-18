import { useState, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
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
import SearchPage from './pages/SearchPage'
import SavedPage from './pages/SavedPage'
import OnboardingFlow from './components/Onboarding/OnboardingFlow'
import SplashScreen from './components/UI/SplashScreen'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading, profile, isExploreMode } = useAuth()

  // If auth tokens are in the URL (email confirmation link), hold the spinner
  // while Supabase exchanges the code for a session. Without this, getSession()
  // resolves null before the exchange finishes → redirect to /auth → user sees
  // the sign-in form and the confirmation link is wasted.
  // The timeout clears the hold after 8s so a failed exchange never hangs forever.
  const [waitingForAuthUrl, setWaitingForAuthUrl] = useState(() =>
    window.location.search.includes('code=') ||
    window.location.hash.includes('access_token')
  )
  useEffect(() => {
    if (!waitingForAuthUrl) return
    if (user) { setWaitingForAuthUrl(false); return }
    const t = setTimeout(() => setWaitingForAuthUrl(false), 8000)
    return () => clearTimeout(t)
  }, [user, waitingForAuthUrl])

  if ((loading || waitingForAuthUrl) && !isExploreMode && !user) return (
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
  // Persist across bfcache restores (mobile back button) so splash only shows once per session
  const [splashDone, setSplashDone] = useState(
    () => sessionStorage.getItem('oodle_splash_done') === '1'
  )

  function handleSplashDone() {
    sessionStorage.setItem('oodle_splash_done', '1')
    setSplashDone(true)
  }

  return (
    <LayoutProvider>
      <AnimatePresence>
        {!splashDone && <SplashScreen onDone={handleSplashDone} />}
      </AnimatePresence>
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
          <Route path="/search"        element={<SearchPage />} />
          <Route path="/saved"         element={<SavedPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </LayoutProvider>
  )
}
