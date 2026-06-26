// Supabase Edge Function — unlock-with-balance
// Atomically deducts from the user's token_balance and records a purchase.
// Used for wallet-based unlocks (no Stripe involved).
//
// Request body:  { postId: string, price: number, threadId?: string }
// Response:      { success: true, newBalance: number }
//
// Deploy: supabase functions deploy unlock-with-balance

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser, getServiceClient } from '../_shared/auth.ts'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { user } = await requireUser(req)
    const db = getServiceClient()

    const { postId: rawPostId, price, threadId } = await req.json() as {
      postId?:   string
      price:     number
      threadId?: string
    }

    if (!rawPostId && !threadId) {
      return json({ error: 'Provide postId or threadId' }, 400)
    }
    if (typeof price !== 'number' || price <= 0) {
      return json({ error: 'Invalid price' }, 400)
    }

    // If only threadId provided, look up the post_id from the thread
    let postId = rawPostId ?? ''
    if (!postId && threadId) {
      const { data: threadRow } = await db
        .from('threads')
        .select('post_id')
        .eq('id', threadId)
        .single()
      if (!threadRow?.post_id) return json({ error: 'Thread not found' }, 404)
      postId = threadRow.post_id
    }

    // ── Check for existing purchase (idempotency) ─────────────────────────────
    const { data: existing } = await db
      .from('post_purchases')
      .select('id')
      .eq('post_id', postId)
      .eq('buyer_id', user.id)
      .maybeSingle()

    if (existing) {
      // Already purchased — return success without charging again
      const { data: userData } = await db
        .from('users')
        .select('token_balance')
        .eq('id', user.id)
        .single()
      return json({ success: true, newBalance: userData?.token_balance ?? 0 })
    }

    // ── Fetch and check balance ───────────────────────────────────────────────
    const { data: userData, error: fetchErr } = await db
      .from('users')
      .select('token_balance')
      .eq('id', user.id)
      .single()

    if (fetchErr || !userData) {
      return json({ error: 'Could not fetch balance' }, 500)
    }

    const currentBalance = userData.token_balance ?? 0
    if (currentBalance < price) {
      return json({ error: 'Insufficient balance', currentBalance }, 402)
    }

    const newBalance = currentBalance - price

    // ── Deduct balance ────────────────────────────────────────────────────────
    const { error: deductErr } = await db
      .from('users')
      .update({ token_balance: newBalance })
      .eq('id', user.id)
      .eq('token_balance', currentBalance) // optimistic lock

    if (deductErr) {
      return json({ error: 'Balance update failed — please try again' }, 500)
    }

    // ── Record purchase ───────────────────────────────────────────────────────
    const { error: purchaseErr } = await db
      .from('post_purchases')
      .insert({
        post_id:   postId,
        buyer_id:  user.id,
        thread_id: threadId ?? null,
        amount:    price,
        status:    'completed',
      })

    if (purchaseErr) {
      // Rollback the balance deduction
      await db
        .from('users')
        .update({ token_balance: currentBalance })
        .eq('id', user.id)
      return json({ error: 'Purchase record failed — balance restored' }, 500)
    }

    console.log(`[unlock-with-balance] User ${user.id} unlocked post ${postId} for $${price}`)

    return json({ success: true, newBalance })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[unlock-with-balance]', err)
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
