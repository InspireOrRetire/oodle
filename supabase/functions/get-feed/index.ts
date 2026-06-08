/**
 * Edge Function: get-feed
 *
 * Returns a ranked, filtered feed of posts for a given location.
 *
 * Feed modes:
 *   - here_only: posts inside the user's current zone only
 *   - nearby: posts within a configurable radius (multiple zones)
 *   - following: posts from zones the user follows
 *
 * Ranking: feed_score DESC (freshness * engagement, precomputed + decay)
 * Filters: blocked users excluded, expired posts excluded
 */

import { corsHeaders } from '../_shared/cors.ts'
import { requireUser, getServiceClient } from '../_shared/auth.ts'

type FeedMode = 'here_only' | 'nearby' | 'following'

interface GetFeedRequest {
  mode: FeedMode
  lat: number
  lng: number
  zoneId?: string          // required for here_only
  radiusMeters?: number    // for nearby mode, default 8047 (5 miles)
  cursor?: string          // ISO timestamp for pagination
  limit?: number
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user } = await requireUser(req)
    const serviceClient = getServiceClient()

    const body: GetFeedRequest = await req.json()
    const {
      mode = 'here_only',
      lat,
      lng,
      zoneId,
      radiusMeters = 8047,
      cursor,
      limit = 30,
    } = body

    const clampedLimit = Math.min(Math.max(limit, 1), 50)

    // --- Get user's blocked user IDs ---
    const { data: blockRows } = await serviceClient
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', user.id)

    const blockedIds = (blockRows ?? []).map((b) => b.blocked_id)

    let posts: unknown[] = []

    // --------------------------------------------------------
    // HERE ONLY
    // --------------------------------------------------------
    if (mode === 'here_only') {
      if (!zoneId) return errorResponse('zoneId required for here_only mode', 400)

      let query = serviceClient
        .from('posts')
        .select(POST_SELECT)
        .eq('zone_id', zoneId)
        .eq('is_deleted', false)
        .eq('is_hidden', false)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
        .order('feed_score', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(clampedLimit)

      if (cursor) {
        query = query.lt('created_at', cursor)
      }

      if (blockedIds.length > 0) {
        query = query.not('user_id', 'in', `(${blockedIds.join(',')})`)
      }

      const { data, error } = await query
      if (error) throw error
      posts = data ?? []
    }

    // --------------------------------------------------------
    // NEARBY
    // --------------------------------------------------------
    else if (mode === 'nearby') {
      // First, find zones within radius
      const { data: nearbyZones, error: zonesErr } = await serviceClient.rpc(
        'get_zones_near_point',
        { p_lat: lat, p_lng: lng, p_max_radius_m: radiusMeters }
      )

      if (zonesErr) throw zonesErr

      const nearbyZoneIds = (nearbyZones ?? []).map((z: { zone_id: string }) => z.zone_id)

      if (nearbyZoneIds.length === 0) {
        return new Response(
          JSON.stringify({ posts: [], hasMore: false, cursor: null }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      let query = serviceClient
        .from('posts')
        .select(POST_SELECT)
        .in('zone_id', nearbyZoneIds)
        .eq('is_deleted', false)
        .eq('is_hidden', false)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
        .order('feed_score', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(clampedLimit)

      if (cursor) {
        query = query.lt('created_at', cursor)
      }

      if (blockedIds.length > 0) {
        query = query.not('user_id', 'in', `(${blockedIds.join(',')})`)
      }

      const { data, error } = await query
      if (error) throw error
      posts = data ?? []
    }

    // --------------------------------------------------------
    // FOLLOWING ZONES
    // --------------------------------------------------------
    else if (mode === 'following') {
      const { data: followed } = await serviceClient
        .from('zone_follows')
        .select('zone_id')
        .eq('user_id', user.id)

      const followedZoneIds = (followed ?? []).map((f: { zone_id: string }) => f.zone_id)

      if (followedZoneIds.length === 0) {
        return new Response(
          JSON.stringify({ posts: [], hasMore: false, cursor: null }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      let query = serviceClient
        .from('posts')
        .select(POST_SELECT)
        .in('zone_id', followedZoneIds)
        .eq('is_deleted', false)
        .eq('is_hidden', false)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(clampedLimit)

      if (cursor) {
        query = query.lt('created_at', cursor)
      }

      if (blockedIds.length > 0) {
        query = query.not('user_id', 'in', `(${blockedIds.join(',')})`)
      }

      const { data, error } = await query
      if (error) throw error
      posts = data ?? []
    }

    // Pagination cursor = created_at of last post
    const hasMore = posts.length === clampedLimit
    const nextCursor =
      hasMore && posts.length > 0
        ? (posts[posts.length - 1] as Record<string, unknown>).created_at
        : null

    return new Response(
      JSON.stringify({ posts, hasMore, cursor: nextCursor }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    if (err instanceof Response) return err
    console.error('get-feed error:', err)
    return errorResponse('Internal server error', 500)
  }
})

// ---- Shared select string (avoids N+1) ----
const POST_SELECT = `
  id, content, post_type, is_anonymous, is_verified,
  created_at, expires_at, decay_type,
  reply_count, reaction_count, echo_count,
  zone_id, posted_lat, posted_lng, distance_from_zone,
  user_id,
  profiles:user_id (username, display_name, avatar_url, trust_score),
  zones:zone_id (id, name, slug, zone_type, city),
  post_media (id, media_type, public_url, thumbnail_path, width, height, duration_seconds, display_order)
`

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
