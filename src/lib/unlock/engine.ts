import { supabase } from '../supabase'
import type { UnlockConfig, UnlockState, UnlockSubmission, UnlockType } from './types'

// ── Fetch unlock configs for a batch of post IDs ──────────────────────────────
export async function fetchUnlockConfigs(
  postIds: string[],
): Promise<Record<string, UnlockConfig[]>> {
  if (!postIds.length) return {}
  const { data } = await (supabase as any)
    .from('unlock_configs')
    .select('*')
    .in('post_id', postIds)
  const result: Record<string, UnlockConfig[]> = {}
  for (const row of (data ?? [])) {
    if (!result[row.post_id]) result[row.post_id] = []
    result[row.post_id].push(row as UnlockConfig)
    result[row.post_id].sort((a, b) => a.sort_order - b.sort_order)
  }
  return result
}

// ── Fetch which relationship unlock types a user has completed per creator ─────
export async function fetchRelationshipCompletions(
  userId:     string,
  creatorIds: string[],
): Promise<Record<string, Set<UnlockType>>> {
  if (!creatorIds.length) return {}
  const { data } = await (supabase as any)
    .from('relationship_completions')
    .select('creator_id, unlock_type')
    .eq('user_id', userId)
    .in('creator_id', creatorIds)
  const result: Record<string, Set<UnlockType>> = {}
  for (const row of (data ?? [])) {
    if (!result[row.creator_id]) result[row.creator_id] = new Set()
    result[row.creator_id].add(row.unlock_type as UnlockType)
  }
  return result
}

// ── Fetch which post IDs the user has completed a transaction unlock for ───────
export async function fetchTransactionCompletions(
  userId:  string,
  postIds: string[],
): Promise<Set<string>> {
  if (!postIds.length) return new Set()
  const { data } = await (supabase as any)
    .from('transaction_completions')
    .select('post_id')
    .eq('user_id', userId)
    .in('post_id', postIds)
  return new Set((data ?? []).map((r: any) => r.post_id))
}

// ── Resolve per-unlock completion states for the modal ────────────────────────
export async function getUnlockStates(
  userId:    string,
  creatorId: string,
  postId:    string,
  configs:   UnlockConfig[],
): Promise<UnlockState[]> {
  const [relMap, txSet] = await Promise.all([
    fetchRelationshipCompletions(userId, [creatorId]),
    fetchTransactionCompletions(userId, [postId]),
  ])
  const completedRel = relMap[creatorId] ?? new Set<UnlockType>()
  return configs.map(config => ({
    config,
    completed: config.unlock_class === 'relationship'
      ? completedRel.has(config.unlock_type)
      : txSet.has(postId),
  }))
}

// ── Determine whether a post is fully unlocked for the current user ────────────
// A post is unlocked when its transaction unlock is complete (relationship
// unlocks are "nice-to-have" context captures; the transaction unlock is the gate).
export function isPostUnlocked(
  postId:      string,
  configs:     UnlockConfig[],
  txCompleted: Set<string>,
  // Legacy: posts without unlock_configs still use post_purchases
  isPurchased?: boolean,
): boolean {
  if (!configs.length) return isPurchased ?? false
  const hasTx = configs.some(c => c.unlock_class === 'transaction')
  if (!hasTx) return true   // relationship-only not possible per validation, but safe
  return txCompleted.has(postId)
}

// ── Save unlock configs when creating/editing a post ─────────────────────────
export async function saveUnlockConfigs(
  postId:  string,
  configs: Array<{
    unlock_type:  UnlockType
    unlock_class: 'relationship' | 'transaction'
    config:       Record<string, unknown>
  }>,
): Promise<void> {
  // Remove any existing non-migration configs for this post
  await (supabase as any)
    .from('unlock_configs')
    .delete()
    .eq('post_id', postId)
    .eq('is_migration', false)

  if (!configs.length) return

  const rows = configs.map((c, i) => ({
    post_id:      postId,
    unlock_type:  c.unlock_type,
    unlock_class: c.unlock_class,
    config:       c.config,
    sort_order:   i,
    is_migration: false,
  }))
  await (supabase as any).from('unlock_configs').insert(rows)
}

// ── Complete all outstanding unlocks in one action ────────────────────────────
// Handles: email/sms/follow (relationship) + free/contact_form/questionnaire/location (transaction)
// Cash is handled separately via the existing unlock-with-balance edge function.
export async function completeNonCashUnlocks(
  submission: UnlockSubmission,
  states:     UnlockState[],
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  const userId = session.user.id

  const outstanding = states.filter(s => !s.completed)

  // ── Relationship unlocks ──
  for (const s of outstanding.filter(s => s.config.unlock_class === 'relationship')) {
    const row: Record<string, unknown> = {
      user_id:               userId,
      creator_id:            submission.creatorId,
      unlock_type:           s.config.unlock_type,
      captured_from_post_id: submission.postId,
    }
    if (s.config.unlock_type === 'email')   row.captured_email = submission.email
    if (s.config.unlock_type === 'sms')     row.captured_phone = submission.phone
    // follow_creator: no extra data needed; follow action is handled UI-side

    await (supabase as any)
      .from('relationship_completions')
      .upsert(row, { onConflict: 'user_id,creator_id,unlock_type', ignoreDuplicates: true })

    // Upsert audience contact (first-touch attribution preserved via ignoreDuplicates on captured_from)
    const contactRow: Record<string, unknown> = {
      creator_id:            submission.creatorId,
      user_id:               userId,
      first_unlock_at:       new Date().toISOString(),
      latest_unlock_at:      new Date().toISOString(),
    }
    if (submission.email) contactRow.email = submission.email
    if (submission.phone) contactRow.phone = submission.phone

    await (supabase as any)
      .from('audience_contacts')
      .upsert(contactRow, { onConflict: 'creator_id,user_id' })
  }

  // ── Non-cash transaction unlocks ──
  const txState = outstanding.find(s => s.config.unlock_class === 'transaction' && s.config.unlock_type !== 'cash')
  if (txState) {
    const formData: Record<string, unknown> = {}
    if (submission.location) formData.location = submission.location
    if (submission.formData) formData.responses = submission.formData

    await (supabase as any)
      .from('transaction_completions')
      .upsert({
        user_id:     userId,
        post_id:     submission.postId,
        unlock_type: txState.config.unlock_type,
        form_data:   Object.keys(formData).length ? formData : null,
      }, { onConflict: 'user_id,post_id', ignoreDuplicates: true })
  }
}
