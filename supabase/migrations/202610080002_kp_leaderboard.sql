-- Member-visible ranking exposes public identity and KP only, never email.
create function public.get_kp_leaderboard() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not hub_private.account_active() then raise exception 'Sign in with an active account to view the leaderboard' using errcode='42501'; end if;
 with ranked as (
  select l.id,coalesce(l.data->>'username','') as username,coalesce(l.data->>'displayName','Kabayan') as "displayName",
   coalesce((l.data->>'points')::bigint,0) as points,
   rank() over(order by coalesce((l.data->>'points')::bigint,0) desc) as rank
  from public.leaderboard l join public.users u on u.id=l.id
  where coalesce(u.data->>'blocked','false')<>'true'
 ), top_members as (select * from ranked order by points desc,lower(username),id limit 50)
 select jsonb_build_object('members',(select coalesce(jsonb_agg(t order by t.points desc,lower(t.username),t.id),'[]'::jsonb) from top_members t),
  'me',(select to_jsonb(r) from ranked r where r.id=auth.uid()::text),'total',(select count(*) from ranked),'updatedAt',clock_timestamp()) into result;
 return result;
end $$;
revoke all on function public.get_kp_leaderboard() from public,anon;
grant execute on function public.get_kp_leaderboard() to authenticated;
