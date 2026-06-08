# Smart Link Q&A — Fresh Project

## Run it locally (2 commands)

1. Open your terminal / command prompt
2. Navigate into the project folder:
   ```
   cd smartlink-qa
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Start the dev server:
   ```
   npm run dev
   ```
5. Open your browser to: **http://localhost:5173**

The app runs in demo mode with mock data — no Supabase needed yet.

---

## Add real auth (optional, when ready)

1. Go to [supabase.com](https://supabase.com) → create a free project
2. Copy `.env.example` to `.env`:
   ```
   cp .env.example .env
   ```
3. Paste your Supabase URL and anon key into `.env`
4. Run `schema.sql` in your Supabase SQL editor
5. Restart the dev server — auth is now live

---

## Deploy to the web (Vercel CLI — no GitHub needed)

1. Install Vercel CLI once:
   ```
   npm install -g vercel
   ```
2. Build your app:
   ```
   npm run build
   ```
3. Deploy:
   ```
   vercel
   ```
4. Follow the prompts — you get a live URL like `smartlink-qa.vercel.app`

To add your Supabase env vars to the live deployment:
```
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel --prod
```

---

## Project structure

```
src/
  pages/          — AuthPage, HomePage, NotificationsPage, InboxPage,
                    MessageDetailPage, ProfilePage, SearchPage
  components/
    Layout/       — Layout + bottom nav
    Post/         — PostModal, AskQuestionSheet
    Menu/         — MenuDrawer (with sign-out)
  contexts/       — AuthContext (Supabase auth)
  data/           — mock.ts (demo data, works without Supabase)
  lib/            — supabase.ts (client + types), time.ts
```

## Pages from your screenshots

| Screen | Route |
|--------|-------|
| Home feed | / |
| Post + Q&A modal | / (tap any post) |
| Notifications | /notifications |
| Creator inbox | /inbox |
| Answer thread (dark mode) | /inbox/:id |
| Profile | /profile |
| Search | /search |
| Sign in / Sign up | /auth |
