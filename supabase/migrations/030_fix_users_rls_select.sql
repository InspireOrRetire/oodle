-- Allow every authenticated user to read their own row in the users table.
-- Without this policy, loadProfile() returns zero rows (no error, just null data)
-- because RLS silently filters out the row, making the profile page show blanks.
--
-- Also allow any authenticated user to read other users' public fields
-- (needed for feed creator info, followers list, etc.)

-- Users can always read their own full profile row
create policy if not exists "users_select_own"
  on public.users
  for select
  using (auth.uid() = id);

-- Any authenticated user can read other users (for public profiles, feed, search)
create policy if not exists "users_select_others"
  on public.users
  for select
  using (auth.role() = 'authenticated');
