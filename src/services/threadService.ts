// ============================================================
// oodle — Thread Service
// Real Supabase implementation of every method that was
// previously in DemoContext. One-to-one API match so screens
// need minimal changes.
//
// DemoContext method → this service function:
//   createThread   → createThread
//   addMessage     → addMessage
//   submitAnswer   → submitAnswer
//   editAnswer     → editAnswer
//   updatePrice    → updatePrice
//   markViewed     → markViewed
//   threads        → getThreads / subscribeToThreads
//   (new)          → getThread / subscribeToMessages
// ============================================================

import { supabase } from '../lib/supabase'
import type {
  ThreadRow, MessageRow, ThreadWithParticipants, AnswerBlock
} from '../lib/database.types'
import type { RealtimeChannel } from '@supabase/supabase-js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function blocksToText(blocks: AnswerBlock[]): string {
  return blocks.map(b => {
    switch (b.type) {
      case 'text':     return b.content
      case 'photo':    return '[Photo]'
      case 'location': return `📍 ${b.address}`
      case 'audio':    return `🎵 Audio (${b.duration}s)`
      case 'list':     return b.items.map((it, i) => b.ordered ? `${i + 1}. ${it}` : `• ${it}`).join('\n')
    }
  }).join('\n\n')
}

// ── Create thread (fan asks a question on a post) ─────────────────────────────
// Returns the new thread id.

export async function createThread(params: {
  postId:    string
  creatorId: string
  fanId:     string
  question:  string   // first message content
  price:     number   // initial suggested price (creator can change later)
}): Promise<string> {
  const { postId, creatorId, fanId, question, price } = params

  // Insert thread
  const { data: thread, error: tErr } = await supabase
    .from('threads')
    .insert({
      post_id:    postId,
      creator_id: creatorId,
      fan_id:     fanId,
      price,
      status:     'clarification',
    })
    .select('id')
    .single()

  if (tErr) throw tErr

  // Insert the opening message
  const { error: mErr } = await supabase
    .from('messages')
    .insert({
      thread_id: thread.id,
      sender_id: fanId,
      content:   question,
    })

  if (mErr) throw mErr

  // Increment question_count on the post so the card shows total questions asked
  await supabase.rpc('increment_question_count', { post_id: postId }).catch(() => {
    // Fallback: direct update if RPC not available
    supabase.from('posts').select('question_count').eq('id', postId).single()
      .then(({ data }) => {
        if (data) supabase.from('posts').update({ question_count: (data.question_count ?? 0) + 1 }).eq('id', postId)
      })
  })

  return thread.id
}

// ── Add a clarification message ───────────────────────────────────────────────

export async function addMessage(params: {
  threadId: string
  senderId: string
  content:  string
}): Promise<MessageRow> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      thread_id: params.threadId,
      sender_id: params.senderId,
      content:   params.content,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// ── Submit answer (creator) ───────────────────────────────────────────────────
// Sets status → 'answered', stores blocks + plain-text fallback.
// Also adjusts price if the creator changed it before answering.

export async function submitAnswer(params: {
  threadId: string
  blocks:   AnswerBlock[]
  price:    number
}): Promise<void> {
  const { threadId, blocks, price } = params

  const { error } = await supabase
    .from('threads')
    .update({
      status:       'answered',
      answer_blocks: blocks as unknown as import('../lib/database.types').Json,
      answer_text:   blocksToText(blocks),
      answered_at:   new Date().toISOString(),
      price,
    })
    .eq('id', threadId)

  if (error) throw error
}

// ── Edit answer (creator, before anyone has purchased) ────────────────────────
// Only the creator can call this. Whether to allow it when purchased
// is enforced at the UI layer (asker_has_viewed check).

export async function editAnswer(params: {
  threadId: string
  blocks:   AnswerBlock[]
}): Promise<void> {
  const { threadId, blocks } = params

  const { error } = await supabase
    .from('threads')
    .update({
      answer_blocks: blocks as unknown as import('../lib/database.types').Json,
      answer_text:   blocksToText(blocks),
    })
    .eq('id', threadId)

  if (error) throw error
}

// ── Update price (creator, any time before purchase) ─────────────────────────

export async function updatePrice(threadId: string, price: number): Promise<void> {
  const { error } = await supabase
    .from('threads')
    .update({ price })
    .eq('id', threadId)

  if (error) throw error
}

// ── Mark answer as viewed by the asker ───────────────────────────────────────
// Called when the fan opens a thread that has status === 'answered'.

export async function markViewed(threadId: string): Promise<void> {
  const { error } = await supabase
    .from('threads')
    .update({ asker_has_viewed: true })
    .eq('id', threadId)

  if (error) throw error
}

// ── Purchase an answer ────────────────────────────────────────────────────────
// In production (Step 6) this is replaced by a Stripe payment flow
// that triggers a SECURITY DEFINER function on the webhook.
// Until then, we insert directly (the RLS policy allows buyer to INSERT).

export async function purchaseAnswer(params: {
  threadId:  string
  postId:    string
  buyerId:   string
  creatorId: string
  amount:    number
}): Promise<void> {
  const { error } = await supabase
    .from('post_purchases')
    .insert({
      thread_id:  params.threadId,
      post_id:    params.postId,
      buyer_id:   params.buyerId,
      creator_id: params.creatorId,
      amount:     params.amount,
    })

  // 23505 = unique_violation: already purchased — treat as success
  if (error && error.code !== '23505') throw error
}

// ── Fetch thread list (inbox) ─────────────────────────────────────────────────
// Returns all threads where the current user is creator or fan.

export async function getThreads(userId: string): Promise<ThreadWithParticipants[]> {
  const { data, error } = await supabase
    .from('threads')
    .select(`
      *,
      post:posts!post_id ( id, image_urls, caption ),
      creator:users!creator_id ( id, username, display_name, avatar_url, response_rate ),
      fan:users!fan_id ( id, username, display_name, avatar_url ),
      messages (
        id, thread_id, sender_id, content, created_at,
        sender:users!sender_id ( id, username, avatar_url )
      )
    `)
    .or(`creator_id.eq.${userId},fan_id.eq.${userId}`)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as ThreadWithParticipants[]
}

// ── Fetch a single thread with all messages ───────────────────────────────────

export async function getThread(threadId: string): Promise<ThreadWithParticipants | null> {
  const { data, error } = await supabase
    .from('threads')
    .select(`
      *,
      post:posts!post_id ( id, image_urls, caption ),
      creator:users!creator_id ( id, username, display_name, avatar_url, response_rate ),
      fan:users!fan_id ( id, username, display_name, avatar_url ),
      messages (
        id, thread_id, sender_id, content, created_at,
        sender:users!sender_id ( id, username, avatar_url )
      )
    `)
    .eq('id', threadId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data as unknown as ThreadWithParticipants
}

// ── Real-time: subscribe to new messages in a thread ─────────────────────────
// Returns an unsubscribe function. Call it in useEffect cleanup.

export function subscribeToMessages(
  threadId: string,
  onMessage: (msg: MessageRow) => void,
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`thread:${threadId}`)
    .on(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'messages',
        filter: `thread_id=eq.${threadId}`,
      },
      payload => onMessage(payload.new as MessageRow),
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}

// ── Submit / update a star rating (fan only) ──────────────────────────────────
// Uses upsert so calling again updates the existing rating.

export async function submitRating(threadId: string, raterId: string, rating: number): Promise<void> {
  const { error } = await supabase
    .from('answer_ratings')
    .upsert(
      { thread_id: threadId, rater_id: raterId, rating },
      { onConflict: 'thread_id,rater_id' },
    )
  if (error) throw error
}

// ── Fetch ratings for a thread ────────────────────────────────────────────────
// Returns the average rating and the calling user's own rating (if any).

export async function getThreadRatings(
  threadId: string,
  currentUserId: string,
): Promise<{ avg: number | null; myRating: number | null; count: number }> {
  const { data, error } = await supabase
    .from('answer_ratings')
    .select('rating, rater_id')
    .eq('thread_id', threadId)

  if (error) throw error
  if (!data || data.length === 0) return { avg: null, myRating: null, count: 0 }

  const myRow   = data.find(r => r.rater_id === currentUserId)
  const total   = data.reduce((sum, r) => sum + r.rating, 0)
  return {
    avg:      Math.round((total / data.length) * 10) / 10,
    myRating: myRow?.rating ?? null,
    count:    data.length,
  }
}

// ── Real-time: subscribe to thread status changes (creator's inbox) ───────────
// Used by the creator's inbox to react to new threads and status changes.

// ── Upload question / reference media files ───────────────────────────────────
// Uses the existing 'post-images' bucket under a 'questions/' prefix.
// Falls back to a base-64 data-URL when Storage is unavailable (demo / local).

export async function uploadQuestionMedia(
  threadId: string,
  files: File[],
): Promise<string[]> {
  const urls: string[] = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const path = `questions/${threadId}/${i}_${Date.now()}.${ext}`
    try {
      const { data, error } = await supabase.storage
        .from('post-images')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (!error && data) {
        const { data: urlData } = supabase.storage
          .from('post-images')
          .getPublicUrl(data.path)
        urls.push(urlData.publicUrl)
        continue
      }
    } catch { /* fall through to data-URL fallback */ }
    // Fallback: base-64 data URL
    const dataUrl = await new Promise<string>(resolve => {
      const reader = new FileReader()
      reader.onload = e => resolve(e.target?.result as string)
      reader.readAsDataURL(file)
    })
    urls.push(dataUrl)
  }
  return urls
}

// ── Create thread with optional media attachments ─────────────────────────────
// postId is nullable — DM-origin questions (no originating post) pass null.
// Each media file is uploaded then sent as a follow-up message in the thread.

export async function createThreadWithMedia(params: {
  postId:      string | null
  creatorId:   string
  fanId:       string
  question:    string
  price:       number
  mediaFiles?: File[]
}): Promise<string> {
  const { postId, creatorId, fanId, question, price, mediaFiles = [] } = params

  // Insert thread
  const { data: thread, error: tErr } = await supabase
    .from('threads')
    .insert({
      post_id:    postId as string,
      creator_id: creatorId,
      fan_id:     fanId,
      price,
      status:     'clarification',
    })
    .select('id')
    .single()

  if (tErr) throw tErr
  const threadId = thread.id

  // Opening message — the question text
  const { error: mErr } = await supabase
    .from('messages')
    .insert({ thread_id: threadId, sender_id: fanId, content: question })
  if (mErr) throw mErr

  // Media messages — best-effort, don't block if one fails
  if (mediaFiles.length > 0) {
    const urls = await uploadQuestionMedia(threadId, mediaFiles)
    for (const url of urls) {
      try {
        await supabase
          .from('messages')
          .insert({ thread_id: threadId, sender_id: fanId, content: url })
      } catch (e) {
        console.error(e)
      }
    }
  }

  return threadId
}

export function subscribeToThreadUpdates(
  userId: string,
  onUpdate: (thread: Partial<ThreadRow> & { id: string }) => void,
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`threads:${userId}`)
    .on(
      'postgres_changes',
      {
        event:  '*',
        schema: 'public',
        table:  'threads',
        filter: `creator_id=eq.${userId}`,
      },
      payload => onUpdate(payload.new as Partial<ThreadRow> & { id: string }),
    )
    .on(
      'postgres_changes',
      {
        event:  '*',
        schema: 'public',
        table:  'threads',
        filter: `fan_id=eq.${userId}`,
      },
      payload => onUpdate(payload.new as Partial<ThreadRow> & { id: string }),
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}
