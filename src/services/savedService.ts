// ============================================================
// oodle — Saved Service
// Manages saved collections and saved items (posts).
// Tables are added via migration 012 and not yet in generated
// DB types — queries use the `db` any-cast until types are regenerated.
// ============================================================

import { supabase as _supabase } from '../lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = _supabase as any

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SavedCollection {
  collection_id: string
  user_id:       string
  name:          string
  created_at:    string
  item_count:    number        // derived client-side
}

export interface SavedItem {
  saved_id:      string
  user_id:       string
  post_id:       string
  collection_id: string | null
  created_at:    string
  post: {
    id:          string
    caption:     string | null
    image_urls:  string[] | null
    price:       number | null
    creator: {
      id:           string
      username:     string
      display_name: string | null
      avatar_url:   string | null
    } | null
  } | null
}

// ── Collections ───────────────────────────────────────────────────────────────

export async function getCollections(userId: string): Promise<SavedCollection[]> {
  const { data, error } = await db
    .from('saved_collections')
    .select('collection_id, user_id, name, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) { console.error('[saved] getCollections', error); return [] }
  return (data ?? []) as SavedCollection[]
}

export async function createCollection(userId: string, name: string): Promise<SavedCollection | null> {
  const { data, error } = await db
    .from('saved_collections')
    .insert({ user_id: userId, name: name.trim() })
    .select('collection_id, user_id, name, created_at')
    .single()

  if (error) { console.error('[saved] createCollection', error); return null }
  return { ...data, item_count: 0 } as SavedCollection
}

// ── Saved items ───────────────────────────────────────────────────────────────

export async function getSavedItems(
  userId: string,
  collectionId?: string | null,   // undefined/null = all items
): Promise<SavedItem[]> {
  let query = db
    .from('saved_items')
    .select(`
      saved_id, user_id, post_id, collection_id, created_at,
      post:posts!post_id (
        id, caption, image_urls, price,
        creator:users!creator_id ( id, username, display_name, avatar_url )
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (collectionId) {
    query = query.eq('collection_id', collectionId)
  }

  const { data, error } = await query
  if (error) { console.error('[saved] getSavedItems', error); return [] }
  return (data ?? []) as SavedItem[]
}

/** Save a post (upsert — safe to call even if already saved) */
export async function savePost(
  userId: string,
  postId: string,
  collectionId?: string | null,
): Promise<void> {
  const { error } = await db
    .from('saved_items')
    .upsert(
      { user_id: userId, post_id: postId, collection_id: collectionId ?? null },
      { onConflict: 'user_id,post_id', ignoreDuplicates: false },
    )
  if (error) console.error('[saved] savePost', error)
}

/** Remove a save entirely (regardless of collection) */
export async function unsavePost(userId: string, postId: string): Promise<void> {
  const { error } = await db
    .from('saved_items')
    .delete()
    .eq('user_id', userId)
    .eq('post_id', postId)

  if (error) console.error('[saved] unsavePost', error)
}

/** Move a saved item to a different collection (or uncollect with null) */
export async function moveToCollection(
  userId: string,
  postId: string,
  collectionId: string | null,
): Promise<void> {
  const { error } = await db
    .from('saved_items')
    .update({ collection_id: collectionId })
    .eq('user_id', userId)
    .eq('post_id', postId)

  if (error) console.error('[saved] moveToCollection', error)
}

/** Returns set of post IDs the user has saved (for bookmark icon state) */
export async function getSavedPostIds(userId: string): Promise<Set<string>> {
  const { data, error } = await db
    .from('saved_items')
    .select('post_id')
    .eq('user_id', userId)

  if (error) return new Set()
  return new Set((data ?? []).map((r: { post_id: string }) => r.post_id))
}
