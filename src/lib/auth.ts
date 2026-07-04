// ============================================================
// oodle — Auth Service
// Wraps Supabase Auth. Call these from your AuthContext or screens.
// ============================================================

import { supabase } from './supabase'
import type { Role, TablesUpdate } from './database.types'

// ── Sign up ───────────────────────────────────────────────────────────────────
// role is stored in user_metadata and read by the handle_new_user() trigger
// to populate users.role on the first INSERT.

export async function signUp(email: string, password: string, role: Role) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role },
    },
  })
  if (error) throw error
  return data
}

// ── Sign in ───────────────────────────────────────────────────────────────────
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

// ── Sign out ──────────────────────────────────────────────────────────────────
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// ── Get current session ───────────────────────────────────────────────────────
export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

// ── Get current user's profile row ───────────────────────────────────────────
// Returns null if not signed in or profile not yet created.
export async function getMyProfile() {
  const session = await getSession()
  if (!session) return null

  const { data, error } = await supabase
    .from('users')
    .select(`
      id, role, username, display_name, avatar_url, bio,
      categories, default_answer_price,
      stripe_onboarded, followers_count, following_count,
      onboarding_completed, response_rate,
      created_at, updated_at
    `)
    .eq('id', session.user.id)
    .maybeSingle()

  if (error) throw error
  return data
}

// ── Delete own account ────────────────────────────────────────────────────────
// Calls a SECURITY DEFINER Postgres function that removes the public.users row
// and the auth.users identity. Client must sign out immediately after.
export async function deleteOwnAccount() {
  const { error } = await supabase.rpc('delete_own_account')
  if (error) throw error
}

// ── Update profile ────────────────────────────────────────────────────────────
// Upserts the users row. Using upsert (not update) so it works even when
// the handle_new_user trigger hasn't created the row yet, and so that a
// silent RLS block on UPDATE (0 rows, no error) doesn't swallow the save.
export async function updateMyProfile(updates: Pick<
  TablesUpdate<'users'>,
  'username' | 'display_name' | 'avatar_url' | 'bio' | 'categories' | 'default_answer_price' | 'onboarding_completed'
>) {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('users')
    .upsert({
      id:    session.user.id,
      email: session.user.email ?? '',
      role:  (session.user.user_metadata?.role as string) ?? 'fan',
      ...updates,
    }, { onConflict: 'id' })

  if (error) throw error
}
