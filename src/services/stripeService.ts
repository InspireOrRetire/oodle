// Frontend helpers for Stripe Connect flows.
// All sensitive work (key usage, charge creation) happens in Edge Functions —
// this file only calls those functions and surfaces the results to the UI.

import { supabase } from '../lib/supabase'

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  }
}

// ── Creator onboarding ──────────────────────────────────────────────────────

// Triggers V2 account creation (if needed) and returns a fresh onboarding URL.
// Redirect the user to `url` to complete Stripe's identity verification flow.
export async function startStripeOnboarding(): Promise<{ url: string; accountId: string }> {
  const res = await fetch(`${FUNCTIONS_URL}/stripe-connect-onboard`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({}),
  })
  if (!res.ok) throw new Error(`Onboarding failed: ${await res.text()}`)
  return res.json()
}

export interface StripeConnectStatus {
  connected: boolean
  accountId?: string
  readyToReceivePayments: boolean
  onboardingComplete: boolean
  requirementsStatus?: string | null
}

// Fetches live account status from Stripe (via the Edge Function).
// Call this on the settings page to show the creator's onboarding state.
export async function getStripeConnectStatus(): Promise<StripeConnectStatus> {
  const res = await fetch(`${FUNCTIONS_URL}/stripe-connect-status`, {
    method: 'GET',
    headers: await authHeaders(),
  })
  if (!res.ok) throw new Error(`Status check failed: ${await res.text()}`)
  return res.json()
}

// ── Answer unlock / checkout ────────────────────────────────────────────────

export interface CheckoutResult {
  url: string
  sessionId: string
}

// Creates a Stripe checkout session for unlocking a paid answer.
// Returns the hosted checkout URL — redirect the user there to complete payment.
export async function createUnlockCheckout(
  postId: string,
  creatorId: string,
  priceInTokens: number
): Promise<CheckoutResult> {
  const res = await fetch(`${FUNCTIONS_URL}/stripe-checkout`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ postId, creatorId, priceInTokens }),
  })
  if (!res.ok) throw new Error(`Checkout creation failed: ${await res.text()}`)
  return res.json()
}

// Convenience wrapper: creates the session then immediately navigates to Stripe.
export async function openUnlockCheckout(
  postId: string,
  creatorId: string,
  priceInTokens: number
): Promise<void> {
  const { url } = await createUnlockCheckout(postId, creatorId, priceInTokens)
  window.location.href = url
}
