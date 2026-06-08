import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface RateLimitConfig {
  action: string
  userId: string
  zoneId?: string
  maxCount: number       // max actions allowed
  windowSeconds: number  // rolling window in seconds
  ipAddress?: string
}

/**
 * Checks velocity log to enforce rate limits.
 * Returns true if the user is within limits (allowed).
 * Returns false if they have exceeded the limit.
 */
export async function checkRateLimit(
  serviceClient: SupabaseClient,
  config: RateLimitConfig
): Promise<{ allowed: boolean; count: number }> {
  const windowStart = new Date(
    Date.now() - config.windowSeconds * 1000
  ).toISOString()

  const { count } = await serviceClient
    .from('velocity_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', config.userId)
    .eq('action_type', config.action)
    .gte('created_at', windowStart)

  const currentCount = count ?? 0
  return { allowed: currentCount < config.maxCount, count: currentCount }
}

/**
 * Logs an action to the velocity log.
 */
export async function logAction(
  serviceClient: SupabaseClient,
  config: Omit<RateLimitConfig, 'maxCount' | 'windowSeconds'>,
  metadata?: Record<string, unknown>
) {
  await serviceClient.from('velocity_log').insert({
    user_id: config.userId,
    action_type: config.action,
    zone_id: config.zoneId ?? null,
    ip_address: config.ipAddress ?? null,
    metadata: metadata ?? null,
  })
}

// Rate limit configurations per action type
export const RATE_LIMITS = {
  post: { maxCount: 10, windowSeconds: 3600 },        // 10 posts/hour
  reply: { maxCount: 30, windowSeconds: 3600 },        // 30 replies/hour
  report: { maxCount: 10, windowSeconds: 3600 },       // 10 reports/hour
  location_verify: { maxCount: 20, windowSeconds: 300 }, // 20 verifies/5min
  echo: { maxCount: 20, windowSeconds: 3600 },          // 20 echoes/hour
} as const
