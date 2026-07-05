// ============================================================
// oodle — Notification Service
// Fetches, marks-read, and subscribes to real-time notifications.
// ============================================================

import { supabase as _supabase } from '../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

// The notifications table is added via migration 011 and is not yet reflected
// in the generated database.types.ts. We cast through unknown to bypass strict
// table-name checking until types are regenerated after migration is applied.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = _supabase as any
// Keep a typed reference for realtime subscriptions which don't need DB types
const supabase = _supabase

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'new_question'
  | 'new_dm_question'
  | 'answer_dropped'
  | 'payment_received'
  | 'payment_processed'
  | 'dm_followup'
  | 'question_declined'

export type NotificationReferenceType = 'thread' | 'post' | 'payment'

export interface AppNotification {
  notification_id: string
  recipient_id:    string
  actor_id:        string | null
  type:            NotificationType
  reference_id:    string | null
  reference_type:  NotificationReferenceType | null
  message:         string
  read:            boolean
  created_at:      string
  actor: {
    id:           string
    username:     string
    display_name: string | null
    avatar_url:   string | null
  } | null
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

export async function getNotifications(userId: string, limit = 40): Promise<AppNotification[]> {
  const { data, error } = await db
    .from('notifications')
    .select(`
      notification_id, recipient_id, actor_id, type,
      reference_id, reference_type, message, read, created_at,
      actor:users!actor_id ( id, username, display_name, avatar_url )
    `)
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[notifications] fetch error', error)
    return []
  }
  return (data ?? []) as AppNotification[]
}

// ── Unread count ──────────────────────────────────────────────────────────────

export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await db
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('read', false)

  if (error) return 0
  return count ?? 0
}

// ── Mark all read ─────────────────────────────────────────────────────────────

export async function markAllRead(userId: string): Promise<void> {
  const { error } = await db
    .from('notifications')
    .update({ read: true })
    .eq('recipient_id', userId)
    .eq('read', false)

  if (error) console.error('[notifications] markAllRead error', error)
}

// ── Real-time subscription ────────────────────────────────────────────────────
// Calls onNew whenever a notification is inserted for this user.
// Returns an unsubscribe function.

export function subscribeToNotifications(
  userId: string,
  onNew: (notif: AppNotification) => void,
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'notifications',
        filter: `recipient_id=eq.${userId}`,
      },
      payload => {
        // Fetch actor separately since realtime payload won't include join
        const raw = payload.new as Omit<AppNotification, 'actor'>
        if (raw.actor_id) {
          supabase
            .from('users')
            .select('id, username, display_name, avatar_url')
            .eq('id', raw.actor_id)
            .single()
            .then(({ data }) => {
              onNew({ ...raw, actor: data ?? null } as AppNotification)
            })
        } else {
          onNew({ ...raw, actor: null } as AppNotification)
        }
      },
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}

// ── Icon / colour helpers ─────────────────────────────────────────────────────

export function notifMeta(type: NotificationType): { emoji: string; accent: string } {
  switch (type) {
    case 'new_question':      return { emoji: '❓', accent: '#7c3aed' }
    case 'new_dm_question':   return { emoji: '💬', accent: '#0ea5e9' }
    case 'answer_dropped':    return { emoji: '✅', accent: '#16a34a' }
    case 'payment_received':  return { emoji: '$?', accent: '#111' }
    case 'payment_processed': return { emoji: '💳', accent: '#111' }
    case 'dm_followup':       return { emoji: '↩️', accent: '#6b7280' }
    case 'question_declined': return { emoji: '✕',  accent: '#dc2626' }
    default:                  return { emoji: '🔔', accent: '#111' }
  }
}
