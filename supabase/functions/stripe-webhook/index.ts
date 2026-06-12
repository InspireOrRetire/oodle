// Supabase Edge Function — stripe-webhook
// Handles both:
//   • V2 thin events  — account requirements & capability changes
//   • V1 normal events — checkout.session.completed (grants answer access)
//
// REQUIRED SECRETS (Supabase Dashboard → Edge Functions → Secrets):
//   STRIPE_SECRET_KEY          — sk_live_... or sk_test_...
//   STRIPE_WEBHOOK_SECRET      — signing secret for V1 checkout events
//   STRIPE_THIN_WEBHOOK_SECRET — signing secret for V2 thin account events
//
// ── Setting up webhook destinations in Stripe Dashboard ──
//
// 1. V1 events (checkout):
//    Dashboard → Developers → Webhooks → Add destination
//    Events from: "Your account" | Payload style: Normal
//    Event type: checkout.session.completed
//    Copy the signing secret → STRIPE_WEBHOOK_SECRET secret
//
// 2. V2 thin events (account requirements):
//    Dashboard → Developers → Webhooks → Add destination
//    Events from: "Connected accounts" | Payload style: Thin
//    Event types:
//      v2.core.account[requirements].updated
//      v2.core.account[.recipient].capability_status_updated
//    Copy the signing secret → STRIPE_THIN_WEBHOOK_SECRET secret
//
// ── Local testing with Stripe CLI ──
//   stripe listen \
//     --thin-events 'v2.core.account[requirements].updated,v2.core.account[.recipient].capability_status_updated' \
//     --forward-thin-to localhost:54321/functions/v1/stripe-webhook
//
// Deploy: supabase functions deploy stripe-webhook

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'npm:stripe@17'
import { corsHeaders } from '../_shared/cors.ts'
import { getServiceClient } from '../_shared/auth.ts'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
if (!STRIPE_SECRET_KEY) {
  throw new Error('[stripe-webhook] Missing STRIPE_SECRET_KEY secret.')
}

const STRIPE_WEBHOOK_SECRET      = Deno.env.get('STRIPE_WEBHOOK_SECRET')
const STRIPE_THIN_WEBHOOK_SECRET = Deno.env.get('STRIPE_THIN_WEBHOOK_SECRET')

const stripeClient = new Stripe(STRIPE_SECRET_KEY)

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Read the raw body — required for signature verification
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature') ?? ''

  // Determine whether this is a V2 thin event or a V1 normal event
  let payloadType: string
  try {
    payloadType = (JSON.parse(body) as { type?: string }).type ?? ''
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const db = getServiceClient()

  // ── V2 thin events ────────────────────────────────────────────────────────
  if (payloadType.startsWith('v2.')) {
    if (!STRIPE_THIN_WEBHOOK_SECRET) {
      console.error('[stripe-webhook] Missing STRIPE_THIN_WEBHOOK_SECRET for V2 events.')
      return new Response('Webhook secret not configured', { status: 500 })
    }

    // parseThinEvent validates the Stripe-Signature header and returns the thin envelope
    const thinEvent = stripeClient.parseThinEvent(body, sig, STRIPE_THIN_WEBHOOK_SECRET)

    // Fetch the full event payload from the V2 events API
    const event = await stripeClient.v2.core.events.retrieve(thinEvent.id)

    // Extract the connected account ID from the event data
    const accountId: string =
      (event as any).data?.account_id ??
      (event as any).related_object?.id ??
      ''

    if (event.type === 'v2.core.account[requirements].updated') {
      // Requirements changed (e.g. regulator added a new field) — re-sync DB
      if (accountId) await handleAccountRequirementsUpdated(accountId, db)
    } else if (event.type === 'v2.core.account[.recipient].capability_status_updated') {
      // Transfer capability went active or inactive — re-sync DB
      if (accountId) await handleCapabilityStatusUpdated(accountId, db)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── V1 normal events ──────────────────────────────────────────────────────
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error('[stripe-webhook] Missing STRIPE_WEBHOOK_SECRET for V1 events.')
    return new Response('Webhook secret not configured', { status: 500 })
  }

  let event: Stripe.Event
  try {
    // constructEventAsync verifies the Stripe-Signature header
    event = await stripeClient.webhooks.constructEventAsync(body, sig, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[stripe-webhook] V1 signature verification failed:', err)
    return new Response('Webhook signature verification failed', { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, db)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

// ── V2 handler: requirements changed ─────────────────────────────────────────
// Re-fetches the live account state and updates stripe_onboarded in the DB.
async function handleAccountRequirementsUpdated(
  stripeAccountId: string,
  db: ReturnType<typeof getServiceClient>
) {
  try {
    const account = await stripeClient.v2.core.accounts.retrieve(stripeAccountId, {
      include: ['configuration.recipient', 'requirements'],
    })

    const requirementsStatus = (account as any).requirements?.summary?.minimum_deadline?.status
    const onboardingComplete  =
      requirementsStatus !== 'currently_due' && requirementsStatus !== 'past_due'

    await db
      .from('users')
      .update({ stripe_onboarded: onboardingComplete })
      .eq('stripe_account_id', stripeAccountId)

    console.log(
      `[stripe-webhook] Account ${stripeAccountId} requirements updated.`,
      `onboardingComplete=${onboardingComplete}`
    )
  } catch (err) {
    console.error('[stripe-webhook] handleAccountRequirementsUpdated error:', err)
  }
}

// ── V2 handler: capability status changed ────────────────────────────────────
// Transfer capability going inactive means the creator can no longer receive funds.
async function handleCapabilityStatusUpdated(
  stripeAccountId: string,
  db: ReturnType<typeof getServiceClient>
) {
  try {
    const account = await stripeClient.v2.core.accounts.retrieve(stripeAccountId, {
      include: ['configuration.recipient'],
    })

    const readyToReceivePayments =
      account?.configuration?.recipient?.capabilities?.stripe_balance
        ?.stripe_transfers?.status === 'active'

    // Only flip to false here; requirements handler flips to true when all reqs met
    if (!readyToReceivePayments) {
      await db
        .from('users')
        .update({ stripe_onboarded: false })
        .eq('stripe_account_id', stripeAccountId)
    }

    console.log(
      `[stripe-webhook] Account ${stripeAccountId} capability updated.`,
      `readyToReceivePayments=${readyToReceivePayments}`
    )
  } catch (err) {
    console.error('[stripe-webhook] handleCapabilityStatusUpdated error:', err)
  }
}

// ── V1 handler: checkout session completed ────────────────────────────────────
// Marks the purchase complete so the buyer can access the unlocked answer.
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  db: ReturnType<typeof getServiceClient>
) {
  const { post_id, buyer_id, price_in_tokens } = session.metadata ?? {}

  if (!post_id || !buyer_id) {
    console.error('[stripe-webhook] checkout.session.completed missing metadata', session.id)
    return
  }

  try {
    // Update the pending purchase record written by stripe-checkout
    const { count } = await db
      .from('post_purchases')
      .update({ status: 'completed' })
      .eq('stripe_session_id', session.id)
      .select('id', { count: 'exact', head: true })

    // Safety net: if the client-side insert race-lost to the webhook, insert now
    if (count === 0) {
      await db.from('post_purchases').insert({
        post_id,
        buyer_id,
        stripe_session_id: session.id,
        amount: Number(price_in_tokens ?? 0),
        status: 'completed',
      })
    }

    console.log(`[stripe-webhook] Unlocked post ${post_id} for buyer ${buyer_id}`)
  } catch (err) {
    console.error('[stripe-webhook] handleCheckoutCompleted error:', err)
  }
}
