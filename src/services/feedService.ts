// ============================================================
// oodle — Feed Service
// Fetches feed data via the get_feed_data RPC and pipes it
// through the feedComposer algorithm.
// ============================================================

import { supabase } from '../lib/supabase'
import { composeFeed, type ComposedPost } from '../lib/feedComposer'
import { formatDistanceToNow } from '../lib/time'
import { MOCK_FEED } from '../lib/mockFeed'

// ── FeedItem — the shape FeedCard expects ─────────────────────────────────────
// Defined here so feedService owns the adapter; HomePage imports this type.

export interface FeedCreator {
  id?:           string          // Supabase user id — populated from real feed, undefined in mock
  username:      string
  display_name:  string
  avatar_url?:   string
  color:         string
  initials:      string
  verified:      boolean
  response_rate: number | null
}

export interface FeedAsker {
  username:       string
  avatar_url:     string
  purchase_count: number
  purchasers:     { username: string; avatar_url: string }[]
}

export interface QAReply {
  username:   string
  avatar_url: string
  question:   string
  price:      number
  time_ago:   string
  cart_count?: number
}

export interface FeedItem {
  id:         string
  creator:    FeedCreator
  time_ago:   string
  views:      number
  type:       'post' | 'qa'
  text?:      string
  images?:    string[]
  // Q&A fields — populated when threads are wired (Step 5)
  question?:  string
  asker?:     FeedAsker
  replies?:   QAReply[]
  price?:           number
  fixed_price?:     number
  post_type?:       'type1' | 'type2'   // defaults to type1 when absent
  location_address?: string
  isLocked:         boolean
  likes:            number
  comments:         number
  saves:            number
  _slot?:           'followed' | 'discovery'
  _categories?:     string[]
}

// ── Adapter: ComposedPost → FeedItem ─────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map(w => w.replace(/[^a-zA-Z0-9]/g, '')[0] ?? '')
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const AVATAR_COLORS = ['#111', '#555', '#8b5cf6', '#dc2626', '#333', '#7c3aed', '#0ea5e9']
function colorFor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function composedPostToFeedItem(cp: ComposedPost): FeedItem {
  const username    = cp.creator_username ?? ''
  const displayName = cp.creator_display_name ?? username
  const postType    = (cp.post_type ?? 'type1') as 'type1' | 'type2'
  const isType2     = postType === 'type2'
  const isPaid      = isType2 || (cp.price !== null && cp.price > 0)
  const isLocked    = isPaid && !cp.is_purchased

  return {
    id: cp.id,
    creator: {
      id:            cp.creator_id,
      username,
      display_name:  displayName,
      avatar_url:    cp.creator_avatar_url ?? undefined,
      color:         colorFor(cp.creator_id),
      initials:      initials(displayName || username),
      verified:      false,
      response_rate: cp.creator_response_rate ?? null,
    },
    time_ago:         formatDistanceToNow(cp.created_at),
    views:            0,
    type:             isPaid ? 'qa' : 'post',
    post_type:        postType,
    text:             cp.caption        ?? undefined,
    images:           cp.image_urls     ?? [],
    price:            cp.price          ?? undefined,
    fixed_price:      cp.fixed_price    ?? undefined,
    location_address: cp.location_address ?? undefined,
    isLocked,
    likes:       0,
    comments:    cp.question_count,
    saves:       0,
    _slot:       cp._slot,
    _categories: cp.categories,
  }
}

// ── fetchExploreFeed ──────────────────────────────────────────────────────────
// Used in explore/guest mode — no user ID needed, queries posts directly.
// Returns recent discovery posts sorted by recency.

// post_type and fixed_price are added via migration 013 and not yet in generated
// DB types. We cast the query result through unknown until types are regenerated.
type PostRow013 = {
  id: string; creator_id: string; caption: string | null; image_urls: string[] | null
  price: number | null; post_type: string | null; fixed_price: number | null
  location_address: string | null; question_count: number; answer_count: number
  created_at: string
  creator: { username: string|null; display_name: string|null; avatar_url: string|null; categories: string[]|null; response_rate: number|null } | null
}

export async function fetchExploreFeed(): Promise<ComposedPost[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawData, error } = await (supabase as any)
    .from('posts')
    .select(`
      id, creator_id, caption, image_urls, price,
      post_type, fixed_price,
      location_address, question_count, answer_count, created_at,
      creator:users!creator_id (
        username, display_name, avatar_url, categories, response_rate
      )
    `)
    .order('created_at', { ascending: false })
    .limit(60)

  if (error || !rawData) return MOCK_FEED
  const data = rawData as PostRow013[]

  const mapped = data.map(post => {
    const c = post.creator

    return {
      id:                    post.id,
      creator_id:            post.creator_id,
      creator_username:      c?.username      ?? '',
      creator_display_name:  c?.display_name  ?? null,
      creator_avatar_url:    c?.avatar_url    ?? null,
      creator_response_rate: c?.response_rate ?? null,
      categories:            c?.categories    ?? [],
      created_at:            post.created_at,
      caption:               post.caption       ?? null,
      image_urls:            post.image_urls    ?? [],
      price:                 post.price         ?? null,
      post_type:             (post.post_type ?? 'type1') as 'type1' | 'type2',
      fixed_price:           post.fixed_price   ?? null,
      location_address:      post.location_address ?? null,
      question_count:        post.question_count,
      answer_count:          post.answer_count,
      is_purchased:          false,
      _slot:                 'discovery' as const,
    }
  })

  // Fall back to mock data if the DB is empty
  return mapped.length > 0 ? mapped : MOCK_FEED
}

// ── fetchComposedFeed ─────────────────────────────────────────────────────────
// Call this from your feed screen's data-fetch layer.
// Returns a composed, ratio-correct array ready to render.

export async function fetchComposedFeed(userId: string): Promise<ComposedPost[]> {
  const { data, error } = await supabase.rpc('get_feed_data', { p_user_id: userId })

  if (error) throw error
  if (!data)  return []

  const result = (data as unknown) as {
    followedPosts:             import('../lib/feedComposer').RawPost[]
    discoveryPosts:            import('../lib/feedComposer').RawPost[]
    followedCreatorCategories: string[]
    followedCreatorCount:      number
  }

  // If the RPC's time window excluded all followed posts but the user does
  // follow creators, fall back to a direct query with no time limit so the
  // feed is never empty for a user with real follows.
  if (result.followedPosts.length === 0 && result.followedCreatorCount > 0) {
    const { data: followRows } = await supabase
      .from('user_following')
      .select('creator_id')
      .eq('follower_id', userId)
      .limit(100)

    const creatorIds = (followRows ?? []).map((r: any) => r.creator_id as string)

    if (creatorIds.length > 0) {
      const { data: posts } = await supabase
        .from('posts')
        .select(`
          id, creator_id, caption, image_urls, price,
          location_address, question_count, answer_count, created_at,
          users!creator_id (
            id, username, display_name, avatar_url, categories, response_rate
          )
        `)
        .in('creator_id', creatorIds)
        .order('created_at', { ascending: false })
        .limit(60)

      if (posts && posts.length > 0) {
        result.followedPosts = (posts as any[]).map(p => ({
          id:                 p.id,
          creator_id:         p.creator_id,
          creator_username:   (p.users as any)?.username ?? '',
          creator_display_name: (p.users as any)?.display_name ?? '',
          creator_avatar_url: (p.users as any)?.avatar_url ?? null,
          categories:         (p.users as any)?.categories ?? [],
          creator_response_rate: (p.users as any)?.response_rate ?? null,
          created_at:         p.created_at,
          caption:            p.caption ?? '',
          image_urls:         p.image_urls ?? [],
          question_count:     p.question_count ?? 0,
          answer_count:       p.answer_count ?? 0,
          price:              p.price ?? 0,
          location_address:   p.location_address ?? null,
          is_purchased:       false,
        }))
      }
    }
  }

  return composeFeed(result)
}

// ── fetchPostById ─────────────────────────────────────────────────────────────
// Used by the post detail screen.

export async function fetchPostById(postId: string, currentUserId: string) {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      id, creator_id, caption, image_urls, price,
      location_address, location_lat, location_lng,
      question_count, answer_count, created_at,
      creator:users!creator_id (
        id, username, display_name, avatar_url, followers_count
      )
    `)
    .eq('id', postId)
    .single()

  if (error) throw error

  // Check if the current user has purchased this post
  const { data: purchase } = await supabase
    .from('post_purchases')
    .select('id')
    .eq('post_id', postId)
    .eq('buyer_id', currentUserId)
    .maybeSingle()

  return { ...data, is_purchased: !!purchase }
}

// ── fetchCreatorProfile ───────────────────────────────────────────────────────
// Used by profile screens and search results.

export async function fetchCreatorProfile(username: string, currentUserId: string) {
  const { data: profile, error } = await supabase
    .from('users')
    .select(`
      id, username, display_name, avatar_url, bio,
      categories, followers_count, following_count,
      role, created_at
    `)
    .eq('username', username)
    .single()

  if (error) throw error

  // Is the current user following this creator?
  const { data: follow } = await supabase
    .from('user_following')
    .select('creator_id')
    .eq('follower_id', currentUserId)
    .eq('creator_id', profile.id)
    .maybeSingle()

  // Fetch creator's posts
  const { data: posts } = await supabase
    .from('posts')
    .select('id, caption, image_urls, price, location_address, question_count, answer_count, created_at')
    .eq('creator_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(30)

  return {
    profile,
    isFollowing: !!follow,
    posts: posts ?? [],
  }
}

// ── searchCreators ────────────────────────────────────────────────────────────
// Trigram-indexed search used by the search overlay.

export async function searchCreators(query: string, limit = 20) {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, display_name, avatar_url, followers_count, role')
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .order('followers_count', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

// ── followCreator / unfollowCreator ───────────────────────────────────────────

export async function followCreator(followerId: string, creatorId: string) {
  const { error } = await supabase
    .from('user_following')
    .insert({ follower_id: followerId, creator_id: creatorId })

  if (error && error.code !== '23505') throw error  // ignore duplicate follows
}

export async function unfollowCreator(followerId: string, creatorId: string) {
  const { error } = await supabase
    .from('user_following')
    .delete()
    .eq('follower_id', followerId)
    .eq('creator_id', creatorId)

  if (error) throw error
}
