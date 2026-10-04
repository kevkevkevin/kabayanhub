-- Hosted Supabase default privileges can grant anon access independently of PUBLIC.
revoke all on function public.save_profile(text,text,text,text), public.claim_reward(text,text,integer), public.redeem_item(text), public.draw_chat_reward(), public.hub_write(text,text,text,jsonb,text) from public, anon;
grant execute on function public.save_profile(text,text,text,text), public.claim_reward(text,text,integer), public.redeem_item(text), public.draw_chat_reward(), public.hub_write(text,text,text,jsonb,text) to authenticated;

-- Keep only ranking fields in a read-only, RLS-protected projection. This avoids
-- exposing a view that queries private accounts with its creator's privileges.
drop view public.leaderboard;
create table public.leaderboard (
  parent_id text not null default '' check(parent_id=''),
  id text primary key references public.users(id) on delete cascade,
  data jsonb not null
);
alter table public.leaderboard enable row level security;
revoke all on public.leaderboard from public, anon, authenticated;
grant select on public.leaderboard to authenticated;
create policy leaderboard_read on public.leaderboard for select to authenticated using(true);

create function hub_private.sync_leaderboard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.leaderboard(id,data) values(new.id,
    jsonb_build_object('username',new.data->'username','displayName',new.data->'displayName','points',new.data->'points'))
  on conflict(id) do update set data=excluded.data;
  return new;
end $$;
revoke all on function hub_private.sync_leaderboard() from public, anon, authenticated;
create trigger sync_leaderboard after insert or update of data on public.users
for each row execute function hub_private.sync_leaderboard();
insert into public.leaderboard(id,data)
select id,jsonb_build_object('username',data->'username','displayName',data->'displayName','points',data->'points') from public.users;
