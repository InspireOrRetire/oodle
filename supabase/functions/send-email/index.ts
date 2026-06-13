// Supabase Edge Function — send-email
// Requires: RESEND_API_KEY secret in Supabase dashboard
// Deploy: supabase functions deploy send-email
//
// Setup steps:
//   1. Create a free account at resend.com
//   2. Add your domain (or use the resend sandbox for testing)
//   3. In Supabase dashboard → Edge Functions → Secrets → add RESEND_API_KEY
//   4. Run: supabase functions deploy send-email

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL     = 'hello@oodle.com'
const FUNDING_URL    = 'https://oodle.com/settings/wallet'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sendViaResend(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  })
  if (!res.ok) throw new Error(`Resend error: ${await res.text()}`)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { type, email, displayName } = await req.json()
    const name = displayName || email

    if (type === 'welcome') {
      await sendViaResend(
        email,
        'Welcome to oodle 👋',
        `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <h1 style="font-size:22px;font-weight:700;color:#111;margin-bottom:8px">Welcome to oodle, ${name}!</h1>
          <p style="color:#555;line-height:1.6;margin-bottom:20px">
            Your account is ready. To start asking questions and unlocking answers,
            you'll need to add tokens to your wallet.
          </p>
          <p style="color:#555;line-height:1.6;margin-bottom:8px">
            <strong>Add funds to your wallet:</strong>
          </p>
          <p style="color:#555;line-height:1.6;margin-bottom:24px">
            Visit your account settings at
            <a href="${FUNDING_URL}" style="color:#111;font-weight:600">oodle.com/settings/wallet</a>
            to top up your balance.
          </p>
          <p style="color:#aaa;font-size:12px;margin-top:32px">
            Questions? Reply to this email anytime.
          </p>
        </div>
        `
      )
    } else if (type === 'insufficient_balance') {
      await sendViaResend(
        email,
        'Add funds to your oodle wallet',
        `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <h1 style="font-size:20px;font-weight:700;color:#111;margin-bottom:8px">Your wallet needs funds</h1>
          <p style="color:#555;line-height:1.6;margin-bottom:20px">
            You tried to unlock an answer but your token balance is too low.
          </p>
          <p style="color:#555;line-height:1.6;margin-bottom:24px">
            Add funds to your wallet at
            <a href="${FUNDING_URL}" style="color:#111;font-weight:600">oodle.com/settings/wallet</a>
            and come back to unlock.
          </p>
          <p style="color:#aaa;font-size:12px;margin-top:32px">
            Manage your account at oodle.com
          </p>
        </div>
        `
      )
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[send-email]', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
