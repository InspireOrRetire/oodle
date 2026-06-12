// Supabase Edge Function — stripe-checkout
// Creates a Stripe hosted checkout session for unlocking an answer.
// Uses a destination charge so the creator receives the funds directly,
// minus OODLE's 15% platform application fee.
//
// REQUIRED SECRETS (Supabase Dashboard → Edge Functions → Secrets):
//   STRIPE_SECRET_KEY  — sk_live_... or sk_test_...
//   SITE_URL           — e.g. https://oodle.com (used for success/cancel URLs)
//
// Request body: { postId: string, creatorId: string, priceInTokens: number }
// Response:     { url: string, sessionId: string }
//
// Deploy: supabase functions deploy stripe-checkout

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'npm:stripe@17'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser, getServiceClient } from '../_shared/auth.ts'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
if (!STRIPE_SECRET_KEY) {
  throw new Error(
    '[stripe-checkout] Missing STRIPE_SECRET_KEY. ' +
    'Add it in: Supabase Dashboard → Edge Functions → Secrets.'
  )
}

const stripeClient = new Stripe(STRIPE_SECRET_KEY)
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://oodle.com'

// 1 token = $1 USD = 100 cents
const CENTS_PER_TOKEN = 100

// OODLE keeps 15% of every transaction as its platform fee
const PLATFORM_FEE_PERCENT = 0.15

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { user } = await requireUser(req)
    const db = getServiceClient()

    const body = await req.json()
    const { postId, creatorId, priceInTokens } = body as {
      postId: string
      creatorId: string
      priceInTokens: number
    }

    if (!postId || !creatorId || !priceInTokens) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: postId, creatorId, priceInTokens' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch the creator — they must be Stripe-onboarded to receive payments
    const { data: creator } = await db
      .from('users')
      .select('stripe_account_id, stripe_onboarded, display_name, username')
      .eq('id', creatorId)
      .single()

    if (!creator?.stripe_account_id || !creator.stripe_onboarded) {
      return new Response(
        JSON.stringify({ error: 'Creator is not yet set up to receive payments' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch post caption for a friendlier line-item label
    const { data: post } = await db
      .from('posts')
      .select('caption')
      .eq('id', postId)
      .single()

    // Convert tokens → cents and calculate the platform fee
    const totalCents = priceInTokens * CENTS_PER_TOKEN
    const applicationFeeCents = Math.round(totalCents * PLATFORM_FEE_PERCENT)

    const creatorHandle = creator.username ?? creator.display_name ?? 'creator'

    // ── Create destination-charge checkout session ────────────────────────────
    // The charge is created on OODLE's platform account; Stripe automatically
    // transfers (totalCents - applicationFeeCents) to the creator's account.
    const session = await stripeClient.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: totalCents,
            product_data: {
              name: `Unlock answer by @${creatorHandle}`,
              description: post?.caption
                ? post.caption.slice(0, 128)
                : `${priceInTokens} token answer unlock`,
              metadata: {
                post_id: postId,
                creator_id: creatorId,
                buyer_id: user.id,
              },
            },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        // OODLE's cut — deducted before funds reach the creator's account
        application_fee_amount: applicationFeeCents,
        transfer_data: {
          destination: creator.stripe_account_id,
        },
        metadata: {
          post_id: postId,
          creator_id: creatorId,
          buyer_id: user.id,
        },
      },
      mode: 'payment',
      success_url: `${SITE_URL}/thread/${postId}?unlock=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${SITE_URL}/thread/${postId}?unlock=cancelled`,
      // metadata is passed through to checkout.session.completed webhook
      metadata: {
        post_id: postId,
        creator_id: creatorId,
        buyer_id: user.id,
        price_in_tokens: String(priceInTokens),
      },
    })

    // Record the pending purchase — status will be updated to 'completed' by webhook
    await db.from('post_purchases').insert({
      post_id: postId,
      buyer_id: user.id,
      stripe_session_id: session.id,
      amount: priceInTokens,
      status: 'pending',
    })

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[stripe-checkout]', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
