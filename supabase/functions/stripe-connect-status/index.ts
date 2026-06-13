// Supabase Edge Function — stripe-connect-status
// Returns the live Stripe onboarding status for the authenticated creator.
// Status is always fetched directly from Stripe (never cached) per spec.
//
// REQUIRED SECRETS (Supabase Dashboard → Edge Functions → Secrets):
//   STRIPE_SECRET_KEY  — sk_live_... or sk_test_...
//
// Deploy: supabase functions deploy stripe-connect-status

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'npm:stripe@17'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser, getServiceClient } from '../_shared/auth.ts'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
if (!STRIPE_SECRET_KEY) {
  throw new Error(
    '[stripe-connect-status] Missing STRIPE_SECRET_KEY. ' +
    'Add it in: Supabase Dashboard → Edge Functions → Secrets.'
  )
}

const stripeClient = new Stripe(STRIPE_SECRET_KEY)

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { user } = await requireUser(req)
    const db = getServiceClient()

    const { data: profile } = await db
      .from('users')
      .select('stripe_account_id')
      .eq('id', user.id)
      .single()

    // Creator hasn't started onboarding yet
    if (!profile?.stripe_account_id) {
      return new Response(
        JSON.stringify({
          connected: false,
          onboardingComplete: false,
          readyToReceivePayments: false,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Always fetch live from Stripe — include recipient config and requirements
    const account = await stripeClient.v2.core.accounts.retrieve(
      profile.stripe_account_id,
      { include: ['configuration.recipient', 'requirements'] }
    )

    // Check whether the stripe_transfers capability is active
    const readyToReceivePayments =
      account?.configuration?.recipient?.capabilities?.stripe_balance
        ?.stripe_transfers?.status === 'active'

    // Check outstanding requirements
    const requirementsStatus =
      (account as any).requirements?.summary?.minimum_deadline?.status
    const onboardingComplete =
      requirementsStatus !== 'currently_due' && requirementsStatus !== 'past_due'

    // Keep the DB flag in sync so the checkout function can gate on it cheaply
    if (onboardingComplete && readyToReceivePayments) {
      await db
        .from('users')
        .update({ stripe_onboarded: true })
        .eq('id', user.id)
    }

    return new Response(
      JSON.stringify({
        connected: true,
        accountId: profile.stripe_account_id,
        readyToReceivePayments,
        onboardingComplete,
        requirementsStatus: requirementsStatus ?? null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[stripe-connect-status]', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
