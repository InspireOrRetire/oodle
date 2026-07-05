// ============================================================
// oodle — AuthContext  (real Supabase auth — no demo mode)
// ============================================================
import {
  createContext, useContext, useEffect, useState, useCallback, ReactNode
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import * as AuthService from '../lib/auth'
import type { Role, UserRow } from '../lib/database.types'

// Omit sensitive fields that are never sent to the client
type Profile = Omit<UserRow, 'email'>

interface AuthCtx {
  session:          Session | null
  user:             User    | null
  profile:          Profile | null
  loading:          boolean
  isExploreMode:    boolean
  enterExploreMode: () => void
  signUp:           (email: string, password: string, role: Role) => Promise<void>
  signIn:           (email: string, password: string) => Promise<void>
  signOut:          () => Promise<void>
  reloadProfile:    () => Promise<void>
  updateProfile:    (updates: Partial<Profile>) => Promise<void>
}

const EXPLORE_KEY = 'oodle_explore_mode'

const Ctx = createContext<AuthCtx | null>(null)

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth must be called inside AuthProvider')
  return c
}

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('users')
    .select(`
      id, role, username, display_name, avatar_url, bio,
      categories, default_answer_price, stripe_account_id, stripe_onboarded,
      followers_count, following_count, onboarding_completed,
      response_rate, token_balance, public_profile,
      email_notifications, push_notifications, show_answer_price,
      created_at, updated_at
    `)
    .eq('id', userId)
    .maybeSingle()   // returns null (not an error) when row is missing

  if (error) throw error
  if (!data) return null

  // Spread data last so actual DB values override any defaults
  return {
    ...{ onboarding_completed: true, response_rate: null },
    ...data,
  } as unknown as Profile
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession]   = useState<Session | null>(null)
  const [user,    setUser]      = useState<User    | null>(null)
  const [profile, setProfile]   = useState<Profile | null>(null)
  const [loading, setLoading]   = useState(true)
  const [exploreMode, setExploreMode] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem(EXPLORE_KEY) === '1'
  )

  useEffect(() => {
    let mounted = true
    let resolved = false

    function markResolved() {
      if (!resolved && mounted) { resolved = true; setLoading(false) }
    }

    // Fallback: if neither getSession nor onAuthStateChange resolves within 3s, unblock the app
    const fallbackTimer = setTimeout(() => { if (mounted) markResolved() }, 3000)

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return
      setSession(s); setUser(s?.user ?? null)
      // Unblock the app as soon as we know the session state — don't wait for profile
      markResolved()
      if (s?.user) {
        const p = await loadProfile(s.user.id).catch(() => null)
        if (mounted) setProfile(p)
      }
    }).catch(() => { if (mounted) markResolved() })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (!mounted) return
      setSession(s); setUser(s?.user ?? null)
      markResolved()

      // On token refresh, just reload the profile with the new token — no retry loop needed
      if (event === 'TOKEN_REFRESHED' && s?.user) {
        const p = await loadProfile(s.user.id).catch(() => null)
        if (mounted) setProfile(p)
        return
      }

      if (s?.user) {
        // Real session — always exit explore mode
        localStorage.removeItem(EXPLORE_KEY)
        setExploreMode(false)
        // handle_new_user() trigger may still be committing — retry with back-off
        let p: Profile | null = null
        for (let i = 0; i < 3; i++) {
          p = await loadProfile(s.user.id).catch(() => null)
          if (p) break
          await new Promise(r => setTimeout(r, 500 * (i + 1)))
        }
        if (mounted) setProfile(p)
      } else {
        if (mounted) setProfile(null)
      }
    })

    return () => { mounted = false; clearTimeout(fallbackTimer); subscription.unsubscribe() }
  }, [])


  const signUp = useCallback(async (email: string, password: string, role: Role) => {
    await AuthService.signUp(email, password, role)
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    // Don't touch loading here — onAuthStateChange will set user once Supabase
    // confirms the session, and RequireAuth will react to that.
    await AuthService.signIn(email, password)
  }, [])

  const enterExploreMode = useCallback(() => {
    localStorage.setItem(EXPLORE_KEY, '1')
    setExploreMode(true)
  }, [])

  const signOut = useCallback(async () => {
    localStorage.removeItem(EXPLORE_KEY)
    setExploreMode(false)
    await AuthService.signOut().catch(() => null)
    setSession(null); setUser(null); setProfile(null)
  }, [])

  const reloadProfile = useCallback(async () => {
    if (!user) return
    const p = await loadProfile(user.id).catch(() => null)
    setProfile(p)
  }, [user])

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    await AuthService.updateMyProfile(updates as Parameters<typeof AuthService.updateMyProfile>[0])
    await reloadProfile()
  }, [reloadProfile])

  return (
    <Ctx.Provider value={{
      session,
      user,
      profile,
      loading,
      isExploreMode:    exploreMode,
      enterExploreMode,
      signUp, signIn, signOut, reloadProfile, updateProfile,
    }}>
      {children}
    </Ctx.Provider>
  )
}
