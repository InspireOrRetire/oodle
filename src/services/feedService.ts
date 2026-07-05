// ============================================================
// oodle — Feed Service
// Fetches feed data via the get_feed_data RPC and pipes it
// through the feedComposer algorithm.
// ============================================================

import { supabase } from '../lib/supabase'
import { composeFeed, type ComposedPost } from '../lib/feedComposer'
import { formatDistanceToNow } from '../lib/time'

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
  const isLocked    = (cp.price !== null && cp.price > 0) && !cp.is_purchased

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
    views:            cp.views ?? 0,
    type:             'post' as const,
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

// ── incrementPostView ─────────────────────────────────────────────────────────
// Fire-and-forget: called once per post page load. Errors are silently ignored.

export async function incrementPostView(postId: string): Promise<void> {
  await (supabase as any).rpc('increment_post_view', { p_post_id: postId })
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
  views: number; created_at: string
  creator: { username: string|null; display_name: string|null; avatar_url: string|null; categories: string[]|null; response_rate: number|null } | null
}

export async function fetchExploreFeed(): Promise<ComposedPost[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawData, error } = await (supabase as any)
    .from('posts')
    .select(`
      id, creator_id, caption, image_urls, price,
      post_type, fixed_price, views,
      location_address, question_count, answer_count, created_at,
      creator:users!creator_id (
        username, display_name, avatar_url, categories, response_rate
      )
    `)
    .order('created_at', { ascending: false })
    .limit(60)

  if (error || !rawData) return []
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
      views:                 post.views ?? 0,
      is_purchased:          false,
      _slot:                 'discovery' as const,
    }
  })

  return mapped
}

// ── fetchComposedFeed ─────────────────────────────────────────────────────────
// Call this from your feed screen's data-fetch layer.
// Returns a composed, ratio-correct array ready to render.

export async function fetchComposedFeed(userId: string): Promise<ComposedPost[]> {
  const { data, error } = await supabase.rpc('get_feed_data', { p_user_id: userId })

  if (error) throw error
  if (!data)  return []

  // The live RPC may return snake_case keys (older DB version) or camelCase
  // (migration-applied version). Normalise both so the composer always gets
  // what it expects regardless of which DB version is running.
  const raw = data as any
  const result = {
    followedPosts:             (raw.followedPosts ?? raw.followed_posts ?? []) as import('../lib/feedComposer').RawPost[],
    discoveryPosts:            (raw.discoveryPosts ?? raw.discovery_posts ?? []) as import('../lib/feedComposer').RawPost[],
    followedCreatorCategories: (raw.followedCreatorCategories ?? raw.followed_creator_categories ?? []) as string[],
    followedCreatorCount:      (raw.followedCreatorCount ?? raw.followed_count ?? 0) as number,
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
          id, creator_id, caption, image_urls, price, views,
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
          views:              p.views ?? 0,
          price:              p.price ?? 0,
          location_address:   p.location_address ?? null,
          is_purchased:       false,
        }))
      }
    }
  }

  const composed = composeFeed(result)

  // ── Platform-wide fallback ────────────────────────────────────────────────
  // When the composed feed is thin (< 20 posts), the time-windowed RPC found
  // very little content — typical on a small platform where creators don't post
  // every day. Pull ALL posts with no time limit, dedup against what's already
  // shown, and append. This gives Threads-style "see everyone" behaviour so
  // new users never land on an empty feed.
  if (composed.length < 20) {
    const shownIds = new Set(composed.map(p => p.id))

    // Grab purchased post IDs so locked posts render correctly in the supplement
    const { data: purchaseRows } = await supabase
      .from('post_purchases')
      .select('post_id')
      .eq('buyer_id', userId)
    const purchasedIds = new Set((purchaseRows ?? []).map((r: any) => r.post_id as string))

    const { data: allPosts } = await (supabase as any)
      .from('posts')
      .select(`
        id, creator_id, caption, image_urls, price,
        post_type, fixed_price, views,
        location_address, question_count, answer_count, created_at,
        users!creator_id (
          username, display_name, avatar_url, categories, response_rate
        )
      `)
      .order('created_at', { ascending: false })
      .limit(60)

    if (allPosts && allPosts.length > 0) {
      const supplement: import('../lib/feedComposer').ComposedPost[] = (allPosts as any[])
        .filter(p => !shownIds.has(p.id))
        .map(p => ({
          id:                    p.id,
          creator_id:            p.creator_id,
          creator_username:      p.users?.username      ?? '',
          creator_display_name:  p.users?.display_name  ?? null,
          creator_avatar_url:    p.users?.avatar_url    ?? null,
          creator_response_rate: p.users?.response_rate ?? null,
          categories:            p.users?.categories    ?? [],
          created_at:            p.created_at,
          caption:               p.caption              ?? null,
          image_urls:            p.image_urls           ?? [],
          price:                 p.price                ?? null,
          post_type:             (p.post_type ?? 'type1') as 'type1' | 'type2',
          fixed_price:           p.fixed_price          ?? null,
          location_address:      p.location_address     ?? null,
          question_count:        p.question_count       ?? 0,
          answer_count:          p.answer_count         ?? 0,
          views:                 p.views                ?? 0,
          is_purchased:          purchasedIds.has(p.id),
          _slot:                 'discovery' as const,
        }))
      return [...composed, ...supplement]
    }
  }

  return composed
}

// ── fetchPostById ─────────────────────────────────────────────────────────────
// Used by the post detail screen.

export async function fetchPostById(postId: string, currentUserId: string) {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      id, creator_id, caption, image_urls, price, views,
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
  // Strip leading @ so typing "@jdevore" still finds "jdevore"
  const q = query.replace(/^@+/, '').trim()
  if (!q) return []

  const { data, error } = await supabase
    .from('users')
    .select('id, username, display_name, avatar_url, followers_count, role')
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%,email.ilike.%${q}%`)
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
