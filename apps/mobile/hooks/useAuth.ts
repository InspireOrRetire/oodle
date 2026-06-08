/**
 * useAuth — thin wrapper around authStore for component consumption.
 */

import { useAuthStore } from '@/stores/authStore'

export function useAuth() {
  const {
    user,
    profile,
    isLoading,
    isInitialized,
    signInWithPhone,
    verifyOtp,
    signInWithEmail,
    signOut,
    refreshProfile,
    setProfile,
  } = useAuthStore()

  const isAuthenticated = !!user
  const hasProfile = !!profile

  return {
    user,
    profile,
    isLoading,
    isInitialized,
    isAuthenticated,
    hasProfile,
    signInWithPhone,
    verifyOtp,
    signInWithEmail,
    signOut,
    refreshProfile,
    setProfile,
  }
}
