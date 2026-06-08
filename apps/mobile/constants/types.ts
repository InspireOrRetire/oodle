/**
 * HERE — Shared TypeScript types
 * Mirror the database schema with client-side representations.
 */

// ============================================================
// AUTH
// ============================================================
export interface AuthUser {
  id: string
  email?: string
  phone?: string
}

// ============================================================
// PROFILES
// ============================================================
export interface Profile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  anonymous_by_default: boolean
  trust_score: number
  is_banned: boolean
  post_count: number
  created_at: string
  updated_at: string
}

// ============================================================
// ZONES
// ============================================================
export type ZoneType = 'micro' | 'area' | 'city' | 'event'

export interface Zone {
  id: string
  name: string
  slug: string
  description: string | null
  zone_type: ZoneType
  // center is stored as PostGIS geography — client sees lat/lng separately
  radius_meters: number
  is_temporary: boolean
  starts_at: string | null
  expires_at: string | null
  venue_name: string | null
  address: string | null
  city: string | null
  country: string
  is_active: boolean
  post_count: number
  follower_count: number
  created_at: string
}

// Lightweight zone returned from get_zones_near_point()
export interface NearbyZone {
  zone_id: string
  name: string
  zone_type: ZoneType
  radius_meters: number
  distance_meters: number
  post_count: number
  is_inside: boolean
}

// ============================================================
// LOCATION
// ============================================================
export type FeedMode = 'here_only' | 'nearby' | 'following'

export interface LocationState {
  lat: number | null
  lng: number | null
  accuracy: number | null
  timestamp: number | null
  permissionGranted: boolean
}

export interface LocationToken {
  token: string
  expiresAt: string
  zoneId: string
  distanceMeters: number
  tokenTtlMinutes: number
}

// ============================================================
// POSTS
// ============================================================
export type PostType = 'text' | 'photo' | 'video' | 'audio' | 'list'
export type DecayType = 'permanent' | 'standard' | 'fast' | 'event'

export interface PostMedia {
  id: string
  post_id: string
  media_type: 'image' | 'video' | 'audio'
  public_url: string
  thumbnail_path: string | null
  width: number | null
  height: number | null
  duration_seconds: number | null
  display_order: number
}

export interface Post {
  id: string
  content: string | null
  post_type: PostType
  is_anonymous: boolean
  is_verified: boolean
  created_at: string
  expires_at: string | null
  decay_type: DecayType
  reply_count: number
  reaction_count: number
  echo_count: number
  zone_id: string
  posted_lat: number
  posted_lng: number
  distance_from_zone: number | null
  user_id: string | null
  // Joined
  profiles: Pick<Profile, 'username' | 'display_name' | 'avatar_url' | 'trust_score'> | null
  zones: Pick<Zone, 'id' | 'name' | 'slug' | 'zone_type' | 'city'> | null
  post_media: PostMedia[]
  // Client-side enrichments
  user_reaction?: ReactionType | null
  anonymous_token?: string   // Only present when user is the author of anonymous post
}

// ============================================================
// REPLIES
// ============================================================
export interface Reply {
  id: string
  post_id: string
  parent_reply_id: string | null
  user_id: string | null
  is_anonymous: boolean
  content: string
  is_verified: boolean
  reaction_count: number
  reply_count: number
  is_deleted: boolean
  created_at: string
  // Joined
  profiles: Pick<Profile, 'username' | 'display_name' | 'avatar_url'> | null
  children?: Reply[]
  user_reaction?: ReactionType | null
}

// ============================================================
// REACTIONS
// ============================================================
export type ReactionType = 'fire' | 'eyes' | 'skull' | 'wave' | 'cap'

export interface Reaction {
  id: string
  user_id: string
  target_type: 'post' | 'reply'
  target_id: string
  reaction_type: ReactionType
  created_at: string
}

// ============================================================
// REPORTS
// ============================================================
export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate_speech'
  | 'misinformation'
  | 'inappropriate'
  | 'other'

export interface Report {
  id: string
  reporter_id: string
  target_type: 'post' | 'reply' | 'user'
  target_id: string
  reason: ReportReason
  description: string | null
  status: 'pending' | 'reviewed' | 'actioned' | 'dismissed'
  created_at: string
}

// ============================================================
// API RESPONSES
// ============================================================
export interface FeedResponse {
  posts: Post[]
  hasMore: boolean
  cursor: string | null
}

export interface VerifyLocationResponse {
  verified: boolean
  token: string
  expiresAt: string
  zoneId: string
  distanceMeters: number
  tokenTtlMinutes: number
}

export interface ApiError {
  error: string
}

// ============================================================
// NAVIGATION
// ============================================================
export type RootStackParamList = {
  '(auth)/index': undefined
  '(auth)/login': undefined
  '(auth)/setup': undefined
  '(app)/index': undefined
  '(app)/compose': { zoneId: string; token: string }
  '(app)/post/[id]': { id: string }
  '(app)/profile/[id]': { id: string }
  '(app)/settings/index': undefined
}
