import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Creates a Supabase client authenticated as the requesting user.
 * Use for user-scoped operations (respects RLS).
 */
export function getUserClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get('Authorization')
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader ?? '' } } }
  )
}

/**
 * Creates a Supabase client with service role.
 * Use for admin operations (bypasses RLS).
 */
export function getServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

/**
 * Extracts and verifies the user from the JWT.
 * Throws if unauthenticated.
 */
export async function requireUser(req: Request) {
  const userClient = getUserClient(req)
  const { data: { user }, error } = await userClient.auth.getUser()
  if (error || !user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return { user, userClient }
}
