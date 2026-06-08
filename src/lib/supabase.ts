/// <reference types="vite/client" />
// ============================================================
// oodle — Supabase Client (singleton — survives Vite HMR)
// ============================================================

import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL   as string
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnon) {
  throw new Error(
    'Missing Supabase env vars.\nSet VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local'
  )
}

// Keep one client across Vite HMR reloads so auth-token lock is never contested.
// We also disable the Web Locks API lock (lock: false) because Vite HMR can leave
// stale lock holders from dead module instances, causing all Supabase requests to
// hang indefinitely waiting for the lock. Without the lock, concurrent token
// refreshes are theoretically possible but in practice never happen in a SPA.
declare global {
  interface Window { __supabase?: ReturnType<typeof createClient<Database>> }
}

function getClient() {
  if (typeof window !== 'undefined' && window.__supabase) return window.__supabase
  const client = createClient<Database>(supabaseUrl, supabaseAnon, {
    auth: {
      autoRefreshToken:   true,
      persistSession:     true,
      detectSessionInUrl: true,
      // Scoped storage key so multiple Supabase projects never clash
      storageKey: `sb-${supabaseUrl.match(/\/\/([^.]+)/)?.[1] ?? 'oodle'}-auth-token`,
      // Disable Web Locks — Vite HMR can leave stale lock holders that block requests forever
      lock: (_name: string, _acquireTimeout: number, fn: () => Promise<unknown>) => fn(),
    },
  })
  if (typeof window !== 'undefined') window.__supabase = client
  return client
}

export const supabase = getClient()
export type { Database }

// ── Legacy types ──────────────────────────────────────────────────────────────

export type Role = 'fan' | 'creator'

export interface Reaction {
  emoji: string
  count: number
}

export interface Question {
  id:              string
  post_id:         string
  asker_id:        string
  creator_id:      string
  question:        string
  price:           number
  status:          'answered' | 'pending'
  created_at:      string
  asker_username:  string
  asker_avatar:    string
  purchase_count?: number
}

export interface Post {
  id:           string
  creator_id:   string
  image_url:    string
  images?:      string[]
  caption:      string
  aspect_ratio: 'vertical' | 'square' | 'wide'
  views_count:  number
  created_at:   string
  username:     string
  avatar_url:   string
  reactions:    Reaction[]
  questions?:   Question[]
  stats?:       { questions?: number; answers?: number; bookmarks?: number }
  asker?: {
    username:       string
    avatar_url:     string
    question:       string
    purchase_count: number
    purchasers:     { username: string; avatar_url: string }[]
  }
}

export interface Notification {
  id:             string
  type:           'purchase' | 'new_question' | 'reaction' | 'answer_posted' | 'new_follower'
  actor_username: string
  actor_avatar:   string
  message:        string
  amount?:        number
  is_read:        boolean
  created_at:     string
  post_image?:    string
}
