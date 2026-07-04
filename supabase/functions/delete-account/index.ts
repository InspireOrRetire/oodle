// Supabase Edge Function — delete-account
// Fully deletes the calling user's account:
// 1. Clears storage files (avatars + post-images) — storage.objects.owner
//    references auth.users with no CASCADE, so these must go first.
// 2. Deletes public.users (cascades to all child tables).
// 3. Calls auth.admin.deleteUser() to wipe the auth identity.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Verify caller identity
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // 1. Delete storage files — user's folder is their UUID in each bucket
  for (const bucket of ['avatars', 'post-images']) {
    const { data: files } = await admin.storage.from(bucket).list(user.id)
    if (files && files.length > 0) {
      const paths = files.map(f => `${user.id}/${f.name}`)
      await admin.storage.from(bucket).remove(paths)
    }
  }

  // 2. Delete public profile (cascades to posts, threads, messages, follows, etc.)
  await admin.from('users').delete().eq('id', user.id)

  // 3. Delete the auth identity
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
