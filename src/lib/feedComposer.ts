/**
 * OODLE Feed Composer
 * -------------------
 * Takes raw post data from Supabase and returns a ratio-correct,
 * interleaved array ready to render.
 *
 * Ratio rules:
 *   - Default:           70% followed  / 30% discovery
 *   - Thin graph (<10):  50% followed  / 50% discovery
 *   - Zero follows:     100% discovery (ranked by engagement + popularity)
 *
 * Interleaving constraints:
 *   - No more than 2 discovery posts in a row — always broken by a followed post
 *   - No discovery creator appears more than once per feed load
 *   - Discovery posts use the identical card format — no labels, no badges
 *   - Paid discovery posts render with the price badge (already-purchased → unlocked)
 *   - Fallback: if discovery pool is too thin, fill remaining slots with followed posts
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type SlotType = 'followed' | 'discovery'

/** Shape of a post record coming from Supabase */
export interface RawPost {
  id: string
  creator_id: string
  creator_username: string
  /** Taxonomy tags: ['fitness', 'nutrition', 'photography', …] */
  categories: string[]
  created_at: string   // ISO 8601
  question_count: number
  answer_count: number
  /** null = free post, number = token unlock price */
  price: number | null
  /** Resolved before calling composer: has the current user bought this? */
  is_purchased: boolean
  // ── Display fields (passed through untouched by the algorithm) ──
  creator_display_name?:  string | null
  creator_avatar_url?:    string | null
  creator_response_rate?: number | null
  caption?:               string | null
  image_urls?:            string[]
  location_address?:      string | null
  post_type?:             'type1' | 'type2'
  fixed_price?:           number | null
}

/** A RawPost annotated with which feed slot it was placed in */
export interface ComposedPost extends RawPost {
  _slot: SlotType
}

/** Everything the composer needs — pull this from your Supabase queries */
export interface FeedComposerInput {
  /** Posts from creators the user already follows, pre-fetched from Supabase */
  followedPosts: RawPost[]
  /** Candidate discovery posts (non-followed creators), pre-fetched from Supabase */
  discoveryPosts: RawPost[]
  /**
   * Union of all category tags across every creator the user follows.
   * Used to compute category-overlap score for discovery ranking.
   * Build this from your `user_following → creator_categories` join.
   */
  followedCreatorCategories: string[]
  /** Total number of creators the user follows (drives ratio selection) */
  followedCreatorCount: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Follow graph is considered "thin" below this threshold → use 50/50 ratio */
const THIN_GRAPH_THRESHOLD = 10

/** Maximum discovery posts allowed consecutively before inserting a followed post */
const MAX_CONSECUTIVE_DISCOVERY = 2

/** Weights for the discovery ranking composite score */
const SCORE_WEIGHTS = {
  categoryOverlap:   0.40,
  engagementVelocity: 0.35,
  recency:            0.25,
}

// ─── Discovery Ranking ────────────────────────────────────────────────────────

/**
 * Score a single discovery post against the user's interest graph.
 * Returns a value in [0, 1] — higher is better.
 */
function scoreDiscoveryPost(
  post: RawPost,
  followedCategories: string[],
  nowMs: number,
): number {
  // ── Category overlap ──────────────────────────────────────────────────────
  // What fraction of the post's categories match something the user already follows?
  let categoryScore = 0
  if (post.categories.length > 0 && followedCategories.length > 0) {
    const followedSet = new Set(followedCategories.map(c => c.toLowerCase()))
    const matches = post.categories.filter(c => followedSet.has(c.toLowerCase())).length
    categoryScore = matches / post.categories.length
  }

  // ── Engagement velocity ───────────────────────────────────────────────────
  // (questions + answers) per hour since posting, normalised to [0, 1] with
  // a soft cap at 10 interactions/hour so one viral post doesn't dominate.
  const ageHours = Math.max(1, (nowMs - new Date(post.created_at).getTime()) / 3_600_000)
  const totalActivity = post.question_count + post.answer_count
  const rawVelocity = totalActivity / ageHours
  const velocityScore = Math.min(rawVelocity / 10, 1)

  // ── Recency ───────────────────────────────────────────────────────────────
  // Exponential decay: full score at 0 h, half score at 48 h, near-zero at ~2 weeks.
  const HALF_LIFE_HOURS = 48
  const recencyScore = Math.pow(0.5, ageHours / HALF_LIFE_HOURS)

  return (
    SCORE_WEIGHTS.categoryOverlap    * categoryScore  +
    SCORE_WEIGHTS.engagementVelocity * velocityScore  +
    SCORE_WEIGHTS.recency            * recencyScore
  )
}

/**
 * Filter, deduplicate, and rank discovery candidates.
 * Guarantees: each creator appears at most once; sorted best → worst.
 */
function rankDiscoveryPool(
  candidates: RawPost[],
  followedCategories: string[],
): RawPost[] {
  const nowMs = Date.now()

  // Score every candidate
  const scored = candidates.map(post => ({
    post,
    score: scoreDiscoveryPost(post, followedCategories, nowMs),
  }))

  // Sort descending
  scored.sort((a, b) => b.score - a.score)

  // Dedupe by creator — keep only the highest-scored post per creator
  const seenCreators = new Set<string>()
  const deduped: RawPost[] = []
  for (const { post } of scored) {
    if (!seenCreators.has(post.creator_id)) {
      seenCreators.add(post.creator_id)
      deduped.push(post)
    }
  }

  return deduped
}

// ─── Ratio Selection ──────────────────────────────────────────────────────────

interface Ratio {
  followedFraction: number
  discoveryFraction: number
}

function selectRatio(followedCreatorCount: number): Ratio {
  if (followedCreatorCount === 0) {
    return { followedFraction: 0, discoveryFraction: 1 }
  }
  if (followedCreatorCount < THIN_GRAPH_THRESHOLD) {
    return { followedFraction: 0.5, discoveryFraction: 0.5 }
  }
  return { followedFraction: 0.7, discoveryFraction: 0.3 }
}

// ─── Interleaver ─────────────────────────────────────────────────────────────

/**
 * Merge followed + discovery posts into a single ordered array, enforcing:
 *   1. The target slot counts (followedTarget, discoveryTarget)
 *   2. No more than MAX_CONSECUTIVE_DISCOVERY discovery posts in a row
 *
 * If the discovery pool runs dry mid-interleave, the remaining discovery
 * slots are back-filled with additional followed posts.
 */
function interleave(
  followed: RawPost[],
  discovery: RawPost[],
  followedTarget: number,
  discoveryTarget: number,
): ComposedPost[] {
  // Work from copies so we don't mutate
  const followedQueue = [...followed].slice(0, followedTarget)
  const discoveryQueue = [...discovery].slice(0, discoveryTarget)

  const result: ComposedPost[] = []
  let consecutiveDiscovery = 0

  while (followedQueue.length > 0 || discoveryQueue.length > 0) {
    const needBreak = consecutiveDiscovery >= MAX_CONSECUTIVE_DISCOVERY

    // Must insert a followed post to break the streak
    if (needBreak) {
      if (followedQueue.length > 0) {
        result.push({ ...followedQueue.shift()!, _slot: 'followed' })
        consecutiveDiscovery = 0
      } else if (discoveryQueue.length > 0) {
        // No followed posts left — have to continue with discovery anyway
        result.push({ ...discoveryQueue.shift()!, _slot: 'discovery' })
        // Don't reset counter — still consecutive, but we have no choice
      }
      continue
    }

    // Determine what to insert next based on current ratio pressure.
    // Compare how far each queue is from its target proportion.
    const totalPlaced = result.length
    const placedFollowed   = result.filter(p => p._slot === 'followed').length
    const placedDiscovery  = totalPlaced - placedFollowed
    const totalTarget      = followedTarget + discoveryTarget

    // Desired fractions at this point in the feed
    const wantFollowed  = followedTarget  / totalTarget
    const wantDiscovery = discoveryTarget / totalTarget

    // Actual fractions so far
    const hasFollowed  = totalPlaced > 0 ? placedFollowed  / totalPlaced : 0
    const hasDiscovery = totalPlaced > 0 ? placedDiscovery / totalPlaced : 0

    // Deficit: positive means we're behind on that type
    const followedDeficit  = wantFollowed  - hasFollowed
    const discoveryDeficit = wantDiscovery - hasDiscovery

    const pickDiscovery =
      discoveryQueue.length > 0 &&
      (followedQueue.length === 0 || discoveryDeficit > followedDeficit)

    if (pickDiscovery) {
      result.push({ ...discoveryQueue.shift()!, _slot: 'discovery' })
      consecutiveDiscovery++
    } else if (followedQueue.length > 0) {
      result.push({ ...followedQueue.shift()!, _slot: 'followed' })
      consecutiveDiscovery = 0
    } else {
      // Drain any leftover discovery
      result.push({ ...discoveryQueue.shift()!, _slot: 'discovery' })
      consecutiveDiscovery++
    }
  }

  return result
}

// ─── Main Composer ────────────────────────────────────────────────────────────

/**
 * composeFeed
 * -----------
 * Call this after your Supabase fetches complete.
 *
 * ```ts
 * const composed = composeFeed({
 *   followedPosts,
 *   discoveryPosts,
 *   followedCreatorCategories,
 *   followedCreatorCount,
 * })
 * // Pass composed directly to your FlatList / feed renderer
 * ```
 *
 * The `_slot` field on each post is 'followed' | 'discovery'.
 * Do NOT use it to render a "Suggested" label — it's for analytics only.
 *
 * Price badge behaviour (matches standard spec):
 *   - post.price !== null && post.question_count === 0  → show price badge on card face
 *   - post.price !== null && post.question_count > 0    → badge drops into Q&A section
 *   - post.is_purchased === true                        → render as unlocked regardless of price
 */
export function composeFeed(input: FeedComposerInput): ComposedPost[] {
  const {
    followedPosts,
    discoveryPosts,
    followedCreatorCategories,
    followedCreatorCount,
  } = input

  // ── 1. Select ratio ───────────────────────────────────────────────────────
  const ratio = selectRatio(followedCreatorCount)

  // ── 2. Rank + dedupe discovery pool ──────────────────────────────────────
  const rankedDiscovery = rankDiscoveryPool(discoveryPosts, followedCreatorCategories)

  // ── 3. Sort followed posts newest-first ───────────────────────────────────
  const sortedFollowed = [...followedPosts].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  // ── 4. Determine target slot counts ───────────────────────────────────────
  //
  // Total feed size = all available followed posts + as many discovery as needed.
  // We target the ratio against the followed pool size, then clamp to what's
  // actually available in the discovery pool, falling back to extra followed posts.
  const totalAvailableFollowed = sortedFollowed.length
  const totalAvailableDiscovery = rankedDiscovery.length

  // Edge case: zero follows → pure discovery feed
  if (ratio.followedFraction === 0) {
    return rankedDiscovery.map(p => ({ ...p, _slot: 'discovery' as SlotType }))
  }

  // How many discovery posts the ratio calls for, given the followed pool
  let discoveryTarget = Math.round(
    (totalAvailableFollowed / ratio.followedFraction) * ratio.discoveryFraction,
  )

  // Clamp to what's actually available
  discoveryTarget = Math.min(discoveryTarget, totalAvailableDiscovery)

  // If discovery pool is too thin, we simply use all of it and fill the rest
  // of the feed with followed posts (graceful fallback — no empty slots)
  const followedTarget = totalAvailableFollowed

  // ── 5. Interleave ─────────────────────────────────────────────────────────
  return interleave(sortedFollowed, rankedDiscovery, followedTarget, discoveryTarget)
}

// ─── Supabase Query Helpers ───────────────────────────────────────────────────
//
// These are the Supabase calls you need to feed the composer.
// Wire these up in your feed screen's data-fetch layer.
//
// ```ts
// import { supabase } from './supabase'
//
// async function fetchFeedData(userId: string) {
//   // 1. Who does the user follow?
//   const { data: following } = await supabase
//     .from('user_following')
//     .select('creator_id')
//     .eq('follower_id', userId)
//
//   const followedIds = following?.map(f => f.creator_id) ?? []
//
//   // 2. Followed-creator posts (last 48h, max 60)
//   const { data: followedPosts } = await supabase
//     .from('posts')
//     .select('id, creator_id, creator_username, categories, created_at, question_count, answer_count, price')
//     .in('creator_id', followedIds)
//     .gte('created_at', new Date(Date.now() - 48 * 3_600_000).toISOString())
//     .order('created_at', { ascending: false })
//     .limit(60)
//
//   // 3. Discovery candidates — NOT from followed creators, last 72h, max 100
//   const { data: discoveryPosts } = await supabase
//     .from('posts')
//     .select('id, creator_id, creator_username, categories, created_at, question_count, answer_count, price')
//     .not('creator_id', 'in', `(${followedIds.join(',')})`)
//     .gte('created_at', new Date(Date.now() - 72 * 3_600_000).toISOString())
//     .order('created_at', { ascending: false })
//     .limit(100)
//
//   // 4. Categories from followed creators (for overlap scoring)
//   const { data: creatorMeta } = await supabase
//     .from('creators')
//     .select('categories')
//     .in('id', followedIds)
//
//   const followedCreatorCategories = [...new Set(
//     (creatorMeta ?? []).flatMap(c => c.categories ?? [])
//   )]
//
//   // 5. Posts this user has already purchased
//   const { data: purchases } = await supabase
//     .from('post_purchases')
//     .select('post_id')
//     .eq('user_id', userId)
//
//   const purchasedIds = new Set(purchases?.map(p => p.post_id) ?? [])
//
//   // 6. Annotate is_purchased on every post
//   const annotate = (posts: RawPost[]) =>
//     posts?.map(p => ({ ...p, is_purchased: purchasedIds.has(p.id) })) ?? []
//
//   return composeFeed({
//     followedPosts:             annotate(followedPosts ?? []),
//     discoveryPosts:            annotate(discoveryPosts ?? []),
//     followedCreatorCategories,
//     followedCreatorCount:      followedIds.length,
//   })
// }
// ```
