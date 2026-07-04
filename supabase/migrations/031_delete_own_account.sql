-- Allows a user to permanently delete their own account.
-- SECURITY DEFINER so the function runs with the permissions needed
-- to delete from auth.users (which normal authenticated users can't touch).
-- search_path is locked to prevent search-path injection attacks.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Delete public data first (FK cascades handle children of users row)
  delete from public.users where id = auth.uid();

  -- Delete the auth identity itself
  delete from auth.users where id = auth.uid();
end;
$$;

-- Only authenticated users can call this; the USING clause ensures
-- they can only trigger deletion for their own uid (enforced inside the fn too).
revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
