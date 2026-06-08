import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { getProfile } from '@/lib/api'
import type { AuthUser, Profile } from '@/constants/types'

interface AuthState {
  user: AuthUser | null
  profile: Profile | null
  isLoading: boolean
  isInitialized: boolean

  // Actions
  initialize: () => Promise<void>
  signInWithPhone: (phone: string) => Promise<{ error: string | null }>
  verifyOtp: (phone: string, token: string) => Promise<{ error: string | null }>
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  setProfile: (profile: Profile) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  isInitialized: false,

  initialize: async () => {
    set({ isLoading: true })

    // Get current session
    const { data: { session } } = await supabase.auth.getSession()

    if (session?.user) {
      const profile = await getProfile(session.user.id)
      set({
        user: {
          id: session.user.id,
          email: session.user.email,
          phone: session.user.phone,
        },
        profile,
        isLoading: false,
        isInitialized: true,
      })
    } else {
      set({ isLoading: false, isInitialized: true })
    }

    // Listen for auth state changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await getProfile(session.user.id)
        set({
          user: {
            id: session.user.id,
            email: session.user.email,
            phone: session.user.phone,
          },
          profile,
        })
      } else if (event === 'SIGNED_OUT') {
        set({ user: null, profile: null })
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        // Token silently refreshed — no state update needed
      }
    })
  },

  signInWithPhone: async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({ phone })
    return { error: error?.message ?? null }
  },

  verifyOtp: async (phone: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    })

    if (error) return { error: error.message }

    if (data.user) {
      const profile = await getProfile(data.user.id)
      set({
        user: {
          id: data.user.id,
          email: data.user.email,
          phone: data.user.phone,
        },
        profile,
      })
    }

    return { error: null }
  },

  signInWithEmail: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }

    if (data.user) {
      const profile = await getProfile(data.user.id)
      set({
        user: {
          id: data.user.id,
          email: data.user.email,
        },
        profile,
      })
    }

    return { error: null }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null })
  },

  refreshProfile: async () => {
    const { user } = get()
    if (!user) return
    const profile = await getProfile(user.id)
    set({ profile })
  },

  setProfile: (profile: Profile) => set({ profile }),
}))
