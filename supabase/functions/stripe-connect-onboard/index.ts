// Supabase Edge Function — stripe-connect-onboard
// Creates (or re-uses) a Stripe V2 connected account for the authenticated
// creator, then generates a fresh onboarding link and returns the URL.
//
// REQUIRED SECRETS (Supabase Dashboard → Edge Functions → Secrets):
//   STRIPE_SECRET_KEY  — sk_live_... or sk_test_...
//   SITE_URL           — e.g. https://oodle.com (used for redirect URLs)
//
// Deploy: supabase functions deploy stripe-connect-onboard

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'npm:stripe@17'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser, getServiceClient } from '../_shared/auth.ts'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
if (!STRIPE_SECRET_KEY) {
  throw new Error(
    '[stripe-connect-onboard] Missing STRIPE_SECRET_KEY. ' +
    'Add it in: Supabase Dashboard → Edge Functions → Secrets.'
  )
}

// Use a single Stripe client for all requests in this function
const stripeClient = new Stripe(STRIPE_SECRET_KEY)

// Redirect base — Stripe returns here after onboarding
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://oodle.com'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Verify the JWT and extract the Supabase user
    const { user } = await requireUser(req)
    // Service client bypasses RLS so we can read/write any user row
    const db = getServiceClient()

    // Look up this creator's existing Stripe account (if any)
    const { data: profile, error: profileErr } = await db
      .from('users')
      .select('stripe_account_id, display_name, email')
      .eq('id', user.id)
      .single()

    if (profileErr || !profile) {
      return new Response(JSON.stringify({ error: 'User profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let stripeAccountId: string = profile.stripe_account_id ?? ''

    // ── Step 1: Create a V2 connected account if none exists ─────────────────
    // V2 API — IMPORTANT: never pass a top-level `type` field here.
    // OODLE is the platform: it collects fees and absorbs losses.
    if (!stripeAccountId) {
      const account = await stripeClient.v2.core.accounts.create({
        display_name: profile.display_name ?? user.email ?? 'Creator',
        contact_email: user.email ?? undefined,
        identity: {
          country: 'us',
        },
        dashboard: 'express',
        defaults: {
          responsibilities: {
            fees_collector: 'application',   // OODLE collects fees
            losses_collector: 'application', // OODLE absorbs losses
          },
        },
        configuration: {
          recipient: {
            capabilities: {
              stripe_balance: {
                stripe_transfers: {
                  requested: true, // Request payout capability
                },
              },
            },
          },
        },
      })

      stripeAccountId = account.id

      // Persist the mapping creator → Stripe account so we never create duplicates
      await db
        .from('users')
        .update({ stripe_account_id: stripeAccountId })
        .eq('id', user.id)
    }

    // ── Step 2: Create a V2 account link for (re-)onboarding ─────────────────
    // A new link must be generated each time — links are single-use and expire.
    const accountLink = await stripeClient.v2.core.accountLinks.create({
      account: stripeAccountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          configurations: ['recipient'],
          // refresh_url: user lands here if the link expires; start onboarding again
          refresh_url: `${SITE_URL}/settings?stripe=refresh`,
          // return_url: user lands here after completing (or skipping) onboarding
          return_url: `${SITE_URL}/settings?stripe=return&accountId=${stripeAccountId}`,
        },
      },
    })

    return new Response(
      JSON.stringify({ url: accountLink.url, accountId: stripeAccountId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    // requireUser throws a Response on 401 — pass it through directly
    if (err instanceof Response) return err
    console.error('[stripe-connect-onboard]', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
