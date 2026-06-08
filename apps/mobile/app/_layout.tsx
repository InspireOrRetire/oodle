import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as SplashScreen from 'expo-splash-screen'
import { useAuthStore } from '@/stores/authStore'

// Keep splash visible while initializing
SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

export default function RootLayout() {
  const { initialize, isInitialized } = useAuthStore()

  useEffect(() => {
    initialize().then(() => {
      SplashScreen.hideAsync()
    })
  }, [])

  if (!isInitialized) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}
