/**
 * Edge Function: report
 *
 * Handles user reports on posts, replies, and users.
 * Includes rate limiting, auto-hide threshold, and auto-ban triggers.
 */

import { corsHeaders } from '../_shared/cors.ts'
import { requireUser, getServiceClient } from '../_shared/auth.ts'
import { checkRateLimit, logAction, RATE_LIMITS } from '../_shared/ratelimit.ts'

const AUTO_HIDE_THRESHOLD = 3  // hide post after N reports
const AUTO_BAN_THRESHOLD = 10  // flag user after N reports across posts

interface ReportRequest {
  targetType: 'post' | 'reply' | 'user'
  targetId: string
  reason: 'spam' | 'harassment' | 'hate_speech' | 'misinformation' | 'inappropriate' | 'other'
  description?: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user } = await requireUser(req)
    const serviceClient = getServiceClient()
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()

    const body: ReportRequest = await req.json()
    const { targetType, targetId, reason, description } = body

    const validTargetTypes = ['post', 'reply', 'user']
    const validReasons = ['spam', 'harassment', 'hate_speech', 'misinformation', 'inappropriate', 'other']

    if (!validTargetTypes.includes(targetType)) return error('Invalid target type', 400)
    if (!validReasons.includes(reason)) return error('Invalid reason', 400)
    if (!targetId) return error('targetId required', 400)

    // --- Rate limit ---
    const { allowed } = await checkRateLimit(serviceClient, {
      action: 'report',
      userId: user.id,
      ipAddress: ipAddress ?? undefined,
      ...RATE_LIMITS.report,
    })
    if (!allowed) return error('Too many reports. Slow down.', 429)

    // --- Prevent duplicate report ---
    const { data: existing } = await serviceClient
      .from('reports')
      .select('id')
      .eq('reporter_id', user.id)
      .eq('target_type', targetType)
      .eq('target_id', targetId)
      .maybeSingle()

    if (existing) return error('You have already reported this', 409)

    // --- Create report ---
    await serviceClient.from('reports').insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reason,
      description: description?.trim().slice(0, 500) ?? null,
    })

    // --- Increment report_count and check thresholds ---
    if (targetType === 'post') {
      const { data: post } = await serviceClient
        .from('posts')
        .select('report_count, user_id')
        .eq('id', targetId)
        .single()

      if (post) {
        const newCount = (post.report_count ?? 0) + 1
        await serviceClient
          .from('posts')
          .update({ report_count: newCount })
          .eq('id', targetId)

        // Auto-hide if threshold reached
        if (newCount >= AUTO_HIDE_THRESHOLD) {
          await serviceClient
            .from('posts')
            .update({ is_hidden: true })
            .eq('id', targetId)

          await serviceClient.from('moderation_actions').insert({
            target_type: 'post',
            target_id: targetId,
            action: 'hide',
            reason: `Auto-hidden after ${newCount} reports`,
          })
        }

        // Check total reports against post author
        if (post.user_id) {
          const { count: userReportCount } = await serviceClient
            .from('reports')
            .select('*', { count: 'exact', head: true })
            .eq('target_type', 'post')
            .in(
              'target_id',
              serviceClient
                .from('posts')
                .select('id')
                .eq('user_id', post.user_id)
            )

          if ((userReportCount ?? 0) >= AUTO_BAN_THRESHOLD) {
            // Flag user for moderator review (not auto-ban)
            await serviceClient.from('moderation_actions').insert({
              target_type: 'user',
              target_id: post.user_id,
              action: 'flag',
              reason: `Auto-flagged: ${userReportCount} reports across posts`,
            })
          }
        }
      }
    }

    if (targetType === 'reply') {
      const { data: reply } = await serviceClient
        .from('replies')
        .select('report_count')
        .eq('id', targetId)
        .single()

      if (reply) {
        const newCount = (reply.report_count ?? 0) + 1
        await serviceClient
          .from('replies')
          .update({ report_count: newCount })
          .eq('id', targetId)

        if (newCount >= AUTO_HIDE_THRESHOLD) {
          await serviceClient
            .from('replies')
            .update({ is_hidden: true })
            .eq('id', targetId)
        }
      }
    }

    // --- Log velocity ---
    await logAction(serviceClient, {
      action: 'report',
      userId: user.id,
      ipAddress: ipAddress ?? undefined,
    }, { targetType, reason })

    return new Response(
      JSON.stringify({ reported: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    if (err instanceof Response) return err
    console.error('report error:', err)
    return error('Internal server error', 500)
  }
})

function error(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
