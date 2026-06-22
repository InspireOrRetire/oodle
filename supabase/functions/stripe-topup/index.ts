// Supabase Edge Function — stripe-topup
// Creates a Stripe hosted checkout session for loading a user's wallet balance.
// Funds go to the platform account (not a creator). The stripe-webhook function
// increments token_balance on checkout.session.completed.
//
// REQUIRED SECRETS (Supabase Dashboard → Edge Functions → Secrets):
//   STRIPE_SECRET_KEY  — sk_live_... or sk_test_...
//   SITE_URL           — e.g. https://oodle.com (used for success/cancel redirect)
//
// Request body: { packId: 'p1' | 'p2' | 'p3' }
// Response:     { url: string, sessionId: string }
//
// Deploy: supabase functions deploy stripe-topup

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'npm:stripe@17'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/auth.ts'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
if (!STRIPE_SECRET_KEY) {
  throw new Error(
    '[stripe-topup] Missing STRIPE_SECRET_KEY. ' +
    'Add it in: Supabase Dashboard → Edge Functions → Secrets.'
  )
}

const stripeClient = new Stripe(STRIPE_SECRET_KEY)
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://oodle.com'

const PACKS = [
  { id: 'p1', balance: 4,    price: 4.99  },
  { id: 'p2', balance: 8.5,  price: 9.99  },
  { id: 'p3', balance: 21,   price: 24.99 },
] as const

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { user } = await requireUser(req)
    const { packId } = await req.json() as { packId: string }

    const pack = PACKS.find(p => p.id === packId)
    if (!pack) {
      return new Response(
        JSON.stringify({ error: `Invalid packId: ${packId}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const session = await stripeClient.checkout.sessions.create({
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(pack.price * 100),
          product_data: {
            name: `Oodle Balance — $${pack.balance.toFixed(2)}`,
            description: `Add $${pack.balance.toFixed(2)} to your Oodle balance`,
          },
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${SITE_URL}?topup=success`,
      cancel_url:  `${SITE_URL}?topup=cancelled`,
      metadata: {
        type:           'topup',
        buyer_id:       user.id,
        balance_amount: String(pack.balance),
        pack_id:        packId,
      },
    })

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[stripe-topup]', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
