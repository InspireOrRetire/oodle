const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  as string
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string

async function callEmailFn(payload: Record<string, unknown>) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON}`,
      },
      body: JSON.stringify(payload),
    })
  } catch {
    // non-blocking — email failures never break the UI
  }
}

export function sendWelcomeEmail(userEmail: string, displayName: string) {
  return callEmailFn({ type: 'welcome', email: userEmail, displayName })
}

export function sendInsufficientBalanceEmail(userEmail: string, displayName: string) {
  return callEmailFn({ type: 'insufficient_balance', email: userEmail, displayName })
}
