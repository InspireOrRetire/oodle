/**
 * Edge Function: claim-post
 *
 * Allows a user to reveal their identity on an anonymous post they authored.
 *
 * Verification: the anonymous_token (stored server-side on the post) must
 * match what the client sends. The client should have stored this token
 * locally at post creation time.
 *
 * Once claimed:
 *  - post.user_id is updated to the claiming user
 *  - post.is_anonymous is set to FALSE
 *  - anonymous_claims record is created for audit
 */

import { corsHeaders } from '../_shared/cors.ts'
import { requireUser, getServiceClient } from '../_shared/auth.ts'

interface ClaimPostRequest {
  postId: string
  anonymousToken: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user } = await requireUser(req)
    const serviceClient = getServiceClient()

    const body: ClaimPostRequest = await req.json()
    const { postId, anonymousToken } = body

    if (!postId || !anonymousToken) {
      return error('postId and anonymousToken required', 400)
    }

    // --- Fetch the post ---
    const { data: post, error: postErr } = await serviceClient
      .from('posts')
      .select('id, is_anonymous, anonymous_token, user_id, is_deleted')
      .eq('id', postId)
      .single()

    if (postErr || !post) return error('Post not found', 404)
    if (post.is_deleted) return error('Post has been deleted', 404)

    // --- Verify it's anonymous ---
    if (!post.is_anonymous) {
      return error('This post is already attributed', 400)
    }

    // --- Verify token matches (constant-time compare) ---
    if (!timingSafeEqual(post.anonymous_token, anonymousToken)) {
      return error('Invalid claim token', 403)
    }

    // --- Check not already claimed ---
    const { data: existingClaim } = await serviceClient
      .from('anonymous_claims')
      .select('id')
      .eq('post_id', postId)
      .maybeSingle()

    if (existingClaim) {
      return error('Post has already been claimed', 409)
    }

    // --- Update post ---
    const { error: updateErr } = await serviceClient
      .from('posts')
      .update({ user_id: user.id, is_anonymous: false })
      .eq('id', postId)

    if (updateErr) {
      console.error('Claim update error:', updateErr)
      return error('Failed to claim post', 500)
    }

    // --- Create audit record ---
    await serviceClient.from('anonymous_claims').insert({
      user_id: user.id,
      post_id: postId,
      anonymous_token: anonymousToken,
    })

    return new Response(
      JSON.stringify({ claimed: true, postId, userId: user.id }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    if (err instanceof Response) return err
    console.error('claim-post error:', err)
    return error('Internal server error', 500)
  }
})

/** Constant-time string comparison to prevent timing attacks */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

function error(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
