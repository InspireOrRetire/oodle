# oodle — Backend Setup

## Prerequisites

- Supabase project created at [supabase.com](https://supabase.com)
- `supabase` CLI installed (`npm i -g supabase`) — optional but useful

---

## Step 1 — Run the Migrations

Go to your Supabase dashboard → **SQL Editor** and run the three migration files **in order**:

1. `supabase/migrations/001_schema.sql` — tables
2. `supabase/migrations/002_indexes_and_functions.sql` — indexes, triggers, RPC
3. `supabase/migrations/003_rls.sql` — row level security

Each file is idempotent-safe to run once. Do not run them twice without a `DROP` migration.

---

## Step 2 — Enable Email Auth

In your Supabase dashboard:

1. **Authentication → Providers → Email** — enable it
2. Set **Confirm email** to **Off** during development (turn it on before launch)
3. Optional: set a custom SMTP provider under **Authentication → SMTP Settings**

---

## Step 3 — Enable Realtime

In your Supabase dashboard → **Database → Replication**:

- Add `messages` to the `supabase_realtime` publication
- Add `threads` to the `supabase_realtime` publication

Or run this SQL:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE threads;
```

---

## Step 4 — Configure Storage (for post images)

In your Supabase dashboard → **Storage**:

1. Create a bucket named `posts` — set it to **Public**
2. Create a bucket named `avatars` — set it to **Public**
3. Add this RLS policy to the `posts` bucket:

```sql
-- Anyone authenticated can read
CREATE POLICY "Public post images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'posts');

-- Only authenticated users can upload
CREATE POLICY "Authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'posts' AND auth.role() = 'authenticated');
```

---

## Step 5 — Wire Environment Variables

```bash
cp .env.example .env.local
```

Fill in `.env.local` with values from **Supabase → Settings → API**:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

For **React Native / Expo**, add the same values to `app.config.js` under `extra`:

```js
extra: {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
}
```

And update `src/lib/supabase.ts` to use `Constants.expoConfig.extra` instead of `import.meta.env`.
Also pass `AsyncStorage` to the Supabase client's `auth.storage` option.

---

## Step 6 — How Auth Works

### Sign Up

```ts
import { signUp } from './src/lib/auth'

await signUp('user@example.com', 'password123', 'creator')
// or
await signUp('user@example.com', 'password123', 'fan')
```

The `role` is stored in `auth.users.raw_user_meta_data`. The `handle_new_user()` trigger
reads it and inserts the corresponding row into `public.users`.

### Sign In

```ts
import { signIn } from './src/lib/auth'
await signIn('user@example.com', 'password123')
```

### In React / React Native — wrap with AuthProvider

```tsx
// App.tsx
import { AuthProvider } from './src/contexts/AuthContext'

export default function App() {
  return (
    <AuthProvider>
      {/* your navigation stack */}
    </AuthProvider>
  )
}
```

Then in any screen:

```ts
const { user, profile, loading, signIn, signOut } = useAuth()
```

---

## Step 7 — Feed

The feed is fetched with a single RPC call:

```ts
import { fetchComposedFeed } from './src/services/feedService'

const feed = await fetchComposedFeed(user.id)
// Returns ComposedPost[] — ratio-correct, interleaved, ready to render
```

The `composeFeed()` algorithm (70/30 followed/discovery, 50/50 thin graph, category scoring)
runs client-side on the data returned by `get_feed_data()`.

---

## Step 8 — Threads (Messaging)

```ts
import * as ThreadService from './src/services/threadService'

// Fan opens a thread
const threadId = await ThreadService.createThread({
  postId, creatorId, fanId: user.id, question, price
})

// Add a message
await ThreadService.addMessage({ threadId, senderId: user.id, content })

// Creator answers
await ThreadService.submitAnswer({ threadId, blocks, price })

// Fan pays (pre-Stripe direct insert)
await ThreadService.purchaseAnswer({ threadId, postId, buyerId, creatorId, amount })

// Real-time messages
const unsub = ThreadService.subscribeToMessages(threadId, msg => {
  setMessages(prev => [...prev, msg])
})
// Call unsub() in cleanup
```

---

## Step 9 — Payments (Stripe Connect — defer until Steps 1–8 are stable)

See `.env.example` for the required keys. The flow will be:

1. Creator onboards via Stripe Connect Express
2. Fan initiates payment → server creates PaymentIntent
3. Stripe webhook fires → Edge Function inserts `post_purchases` row
4. Client subscribes to `post_purchases` via Realtime → unlocks the answer

---

## Key RLS Rules Summary

| Table | Who can SELECT | Who can INSERT | Who can UPDATE |
|---|---|---|---|
| `users` | Any authenticated user | Trigger only | Own row |
| `posts` | Any authenticated user | Creator only (own) | Creator only (own) |
| `threads` | Participants + purchasers | Fan (own fan_id) | Both participants |
| `messages` | Thread participants | Thread participants | — |
| `post_purchases` | Buyer or creator | Buyer (own) | — |
| `user_following` | Any authenticated user | Own follower_id | — |
