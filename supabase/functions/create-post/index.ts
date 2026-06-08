/**
 * Edge Function: create-post
 *
 * Server-side post creation with token validation.
 * This is the ONLY way to create a post — client cannot
 * write directly to the posts table without a valid token.
 *
 * Flow:
 *  1. Validate JWT (user identity)
 *  2. Validate location_token (not expired, not used, user matches)
 *  3. Rate limit check
 *  4. Content moderation (basic keyword filter)
 *  5. Insert post
 *  6. Mark token as used
 *  7. Return post
 */

import { corsHeaders } from '../_shared/cors.ts'
import { requireUser, getServiceClient } from '../_shared/auth.ts'
import { checkRateLimit, logAction, RATE_LIMITS } from '../_shared/ratelimit.ts'

const BLOCKED_PATTERNS = [
  /\b(nigger|faggot|kike|spic)\b/i,
  // Add more as needed — this is a starter list
]

type PostType = 'text' | 'photo' | 'video' | 'audio' | 'list'
type DecayType = 'permanent' | 'standard' | 'fast' | 'event'

interface CreatePostRequest {
  locationToken: string
  content?: string
  postType: PostType
  isAnonymous?: boolean
  decayType?: DecayType
  mediaIds?: string[]   // IDs of already-uploaded post_media rows
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user } = await requireUser(req)
    const serviceClient = getServiceClient()
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()

    const body: CreatePostRequest = await req.json()
    const {
      locationToken,
      content,
      postType = 'text',
      isAnonymous = false,
      decayType = 'standard',
      mediaIds = [],
    } = body

    // --- Basic validation ---
    if (!locationToken) {
      return error('Location token required', 400)
    }

    const validPostTypes: PostType[] = ['text', 'photo', 'video', 'audio', 'list']
    if (!validPostTypes.includes(postType)) {
      return error('Invalid post type', 400)
    }

    if (postType === 'text' && (!content || content.trim().length === 0)) {
      return error('Text posts require content', 400)
    }

    if (content && content.length > 500) {
      return error('Post content exceeds 500 character limit', 400)
    }

    // --- Content moderation ---
    if (content) {
      for (const pattern of BLOCKED_PATTERNS) {
        if (pattern.test(content)) {
          return error('Post contains prohibited content', 400)
        }
      }
    }

    // --- Rate limit ---
    const { allowed } = await checkRateLimit(serviceClient, {
      action: 'post',
      userId: user.id,
      ipAddress: ipAddress ?? undefined,
      ...RATE_LIMITS.post,
    })
    if (!allowed) {
      return error('Too many posts. Try again later.', 429)
    }

    // --- Validate and consume location token ---
    const { data: tokenRow, error: tokenErr } = await serviceClient
      .from('location_tokens')
      .select('id, zone_id, user_id, expires_at, used, lat, lng, distance_to_zone_center')
      .eq('token', locationToken)
      .single()

    if (tokenErr || !tokenRow) {
      return error('Invalid location token', 403)
    }

    if (tokenRow.used) {
      return error('Location token already used', 403)
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      return error('Location token expired. Verify your location again.', 403)
    }

    if (tokenRow.user_id !== user.id) {
      return error('Location token does not belong to you', 403)
    }

    // --- Check user is not banned ---
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('is_banned, ban_expires_at')
      .eq('id', user.id)
      .single()

    if (profile?.is_banned) {
      const stillBanned =
        !profile.ban_expires_at || new Date(profile.ban_expires_at) > new Date()
      if (stillBanned) return error('Account suspended', 403)
    }

    // --- Create post ---
    const { data: post, error: postErr } = await serviceClient
      .from('posts')
      .insert({
        user_id: isAnonymous ? null : user.id,
        is_anonymous: isAnonymous,
        content: content?.trim() ?? null,
        post_type: postType,
        zone_id: tokenRow.zone_id,
        posted_lat: tokenRow.lat,
        posted_lng: tokenRow.lng,
        location_token_id: tokenRow.id,
        is_verified: true,
        distance_from_zone: tokenRow.distance_to_zone_center,
        decay_type: decayType,
        feed_score: 5.0, // initial score: slight verified boost
      })
      .select(`
        id, content, post_type, is_anonymous, is_verified,
        created_at, decay_type, expires_at, zone_id,
        reply_count, reaction_count, echo_count,
        zones(id, name, slug, zone_type)
      `)
      .single()

    if (postErr || !post) {
      console.error('Post insert error:', postErr)
      return error('Failed to create post', 500)
    }

    // --- Mark token as used ---
    await serviceClient
      .from('location_tokens')
      .update({ used: true, used_at: new Date().toISOString() })
      .eq('id', tokenRow.id)

    // --- Attach media if provided ---
    if (mediaIds.length > 0) {
      await serviceClient
        .from('post_media')
        .update({ post_id: post.id })
        .in('id', mediaIds)
    }

    // --- Log velocity ---
    await logAction(
      serviceClient,
      { action: 'post', userId: user.id, zoneId: tokenRow.zone_id, ipAddress: ipAddress ?? undefined },
      { postType, isAnonymous }
    )

    return new Response(JSON.stringify({ post }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('create-post error:', err)
    return error('Internal server error', 500)
  }
})

function error(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
