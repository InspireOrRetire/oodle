import { useEffect } from 'react'
import { Stack, router } from 'expo-router'
import { useAuth } from '@/hooks/useAuth'

export default function AuthLayout() {
  const { isAuthenticated, hasProfile } = useAuth()

  useEffect(() => {
    if (isAuthenticated && hasProfile) {
      router.replace('/(app)')
    }
  }, [isAuthenticated, hasProfile])

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    />
  )
}
