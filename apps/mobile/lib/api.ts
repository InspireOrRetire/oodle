/**
 * HERE — API layer
 * All Supabase calls go through here (not scattered through components).
 */

import { supabase, callEdgeFunction } from './supabase'
import type {
  Post,
  Reply,
  Profile,
  Zone,
  NearbyZone,
  FeedMode,
  FeedResponse,
  ReactionType,
  ReportReason,
  PostType,
  DecayType,
} from '@/constants/types'

// ============================================================
// PROFILES
// ============================================================
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data
}

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single()
  return data
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'display_name' | 'bio' | 'avatar_url' | 'anonymous_by_default'>>
): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()
  return data
}

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('username', username.toLowerCase().trim())
  return (count ?? 1) === 0
}

export async function createProfile(
  userId: string,
  username: string,
  displayName?: string
): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .insert({ id: userId, username: username.toLowerCase().trim(), display_name: displayName ?? null })
    .select()
    .single()
  return data
}

// ============================================================
// ZONES
// ============================================================
export async function getNearbyZones(
  lat: number,
  lng: number,
  radiusMeters = 16093
): Promise<NearbyZone[]> {
  const { data } = await supabase.rpc('get_zones_near_point', {
    p_lat: lat,
    p_lng: lng,
    p_max_radius_m: radiusMeters,
  })
  return data ?? []
}

export async function getZone(zoneId: string): Promise<Zone | null> {
  const { data } = await supabase
    .from('zones')
    .select('*')
    .eq('id', zoneId)
    .single()
  return data
}

export async function followZone(userId: string, zoneId: string): Promise<void> {
  await supabase.from('zone_follows').upsert({ user_id: userId, zone_id: zoneId })
}

export async function unfollowZone(userId: string, zoneId: string): Promise<void> {
  await supabase
    .from('zone_follows')
    .delete()
    .eq('user_id', userId)
    .eq('zone_id', zoneId)
}

export async function isFollowingZone(userId: string, zoneId: string): Promise<boolean> {
  const { count } = await supabase
    .from('zone_follows')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('zone_id', zoneId)
  return (count ?? 0) > 0
}

// ============================================================
// FEED
// ============================================================
export async function getFeed(params: {
  mode: FeedMode
  lat: number
  lng: number
  zoneId?: string
  radiusMeters?: number
  cursor?: string
  limit?: number
}): Promise<FeedResponse> {
  return callEdgeFunction<FeedResponse>('get-feed', params)
}

// ============================================================
// POSTS
// ============================================================
export async function createPost(params: {
  locationToken: string
  content?: string
  postType: PostType
  isAnonymous?: boolean
  decayType?: DecayType
  mediaIds?: string[]
}): Promise<Post> {
  const result = await callEdgeFunction<{ post: Post }>('create-post', params)
  return result.post
}

export async function getPost(postId: string): Promise<Post | null> {
  const { data } = await supabase
    .from('posts')
    .select(`
      id, content, post_type, is_anonymous, is_verified,
      created_at, expires_at, decay_type,
      reply_count, reaction_count, echo_count,
      zone_id, posted_lat, posted_lng, distance_from_zone, user_id,
      profiles:user_id (username, display_name, avatar_url, trust_score),
      zones:zone_id (id, name, slug, zone_type, city),
      post_media (id, media_type, public_url, thumbnail_path, width, height, duration_seconds, display_order)
    `)
    .eq('id', postId)
    .eq('is_deleted', false)
    .single()
  return data as Post | null
}

export async function softDeletePost(postId: string): Promise<void> {
  await supabase
    .from('posts')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', postId)
}

// ============================================================
// REPLIES
// ============================================================
export async function getReplies(postId: string): Promise<Reply[]> {
  const { data } = await supabase
    .from('replies')
    .select(`
      id, post_id, parent_reply_id, user_id, is_anonymous, content,
      is_verified, reaction_count, reply_count, is_deleted, created_at,
      profiles:user_id (username, display_name, avatar_url)
    `)
    .eq('post_id', postId)
    .eq('is_deleted', false)
    .eq('is_hidden', false)
    .order('created_at', { ascending: true })
  return (data as Reply[]) ?? []
}

export async function createReply(params: {
  postId: string
  content: string
  isAnonymous?: boolean
  parentReplyId?: string
  zoneId?: string
}): Promise<Reply | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('replies')
    .insert({
      post_id: params.postId,
      parent_reply_id: params.parentReplyId ?? null,
      user_id: params.isAnonymous ? null : user.id,
      is_anonymous: params.isAnonymous ?? false,
      content: params.content.trim(),
      zone_id: params.zoneId ?? null,
    })
    .select(`
      id, post_id, parent_reply_id, user_id, is_anonymous, content,
      is_verified, reaction_count, reply_count, is_deleted, created_at,
      profiles:user_id (username, display_name, avatar_url)
    `)
    .single()
  return data as Reply | null
}

// ============================================================
// REACTIONS
// ============================================================
export async function toggleReaction(
  targetType: 'post' | 'reply',
  targetId: string,
  reactionType: ReactionType
): Promise<{ added: boolean }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Check existing
  const { data: existing } = await supabase
    .from('reactions')
    .select('id, reaction_type')
    .eq('user_id', user.id)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .maybeSingle()

  if (existing) {
    if (existing.reaction_type === reactionType) {
      // Remove reaction
      await supabase.from('reactions').delete().eq('id', existing.id)
      return { added: false }
    } else {
      // Change reaction type
      await supabase
        .from('reactions')
        .update({ reaction_type: reactionType })
        .eq('id', existing.id)
      return { added: true }
    }
  } else {
    // Add reaction
    await supabase.from('reactions').insert({
      user_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reaction_type: reactionType,
    })
    return { added: true }
  }
}

export async function getUserReaction(
  targetType: 'post' | 'reply',
  targetId: string
): Promise<ReactionType | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('reactions')
    .select('reaction_type')
    .eq('user_id', user.id)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .maybeSingle()
  return data?.reaction_type ?? null
}

// ============================================================
// REPORTS
// ============================================================
export async function reportContent(params: {
  targetType: 'post' | 'reply' | 'user'
  targetId: string
  reason: ReportReason
  description?: string
}): Promise<void> {
  await callEdgeFunction('report', params)
}

// ============================================================
// BLOCKS
// ============================================================
export async function blockUser(blockedId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase
    .from('blocks')
    .upsert({ blocker_id: user.id, blocked_id: blockedId })
}

export async function unblockUser(blockedId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', blockedId)
}

// ============================================================
// ANONYMOUS CLAIM
// ============================================================
export async function claimPost(postId: string, anonymousToken: string): Promise<boolean> {
  try {
    await callEdgeFunction('claim-post', { postId, anonymousToken })
    return true
  } catch {
    return false
  }
}

// ============================================================
// MEDIA UPLOAD
// Returns the post_media row id and signed URL for later attachment.
// ============================================================
export async function uploadPostMedia(
  localUri: string,
  mediaType: 'image' | 'video' | 'audio',
  mimeType: string
): Promise<{ id: string; public_url: string } | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const ext = mimeType.split('/')[1] ?? 'bin'
  const fileName = `${user.id}/${Date.now()}.${ext}`

  // Read the file as blob
  const response = await fetch(localUri)
  const blob = await response.blob()

  const { error: uploadErr } = await supabase.storage
    .from('post-media')
    .upload(fileName, blob, { contentType: mimeType, upsert: false })

  if (uploadErr) {
    console.error('Media upload error:', uploadErr)
    return null
  }

  const { data: urlData } = supabase.storage
    .from('post-media')
    .getPublicUrl(fileName)

  // Create post_media row (post_id will be attached after post creation)
  const { data: mediaRow } = await supabase
    .from('post_media')
    .insert({
      post_id: '00000000-0000-0000-0000-000000000000', // placeholder
      media_type: mediaType,
      storage_path: fileName,
      public_url: urlData.publicUrl,
    })
    .select('id, public_url')
    .single()

  return mediaRow
}
