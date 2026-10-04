-- Avoid a PL/pgSQL column/variable ambiguity in the optional chat reward.
create or replace function public.draw_chat_reward() returns jsonb language plpgsql security definer set search_path='' as $$
declare round_start timestamptz=to_timestamp(floor(extract(epoch from now())/600)*600); winner_id text; winner_name text; stamp text=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
 if auth.uid() is null then raise exception 'Sign in first' using errcode='42501'; end if;
 if not exists(select 1 from public.tambayan_config where id='display' and data->>'earningPointsEnabled'='true') then return null; end if;
 perform pg_advisory_xact_lock(601301);
 if exists(select 1 from hub_private.chat_reward_rounds r where r.round_at=round_start) then return null; end if;
 select eligible.uid into winner_id from (
  select distinct data->>'uid' as uid from public.tambayan_chat
  where (data->>'createdAt')::timestamptz>=round_start-interval '20 minutes' and (data->>'createdAt')::timestamptz<round_start-interval '10 minutes'
 ) eligible join public.users u on u.id=eligible.uid order by random() limit 1;
 if winner_id is null then return null; end if;
 insert into hub_private.chat_reward_rounds values(round_start,winner_id);
 update public.users set data=data||jsonb_build_object('points',coalesce((data->>'points')::integer,0)+50) where id=winner_id returning coalesce(data->>'username','Kabayan') into winner_name;
 insert into public.activities(parent_id,id,data) values(winner_id,'chat_'||extract(epoch from round_start)::bigint,jsonb_build_object('type','chat_reward','amount',50,'createdAt',stamp));
 return jsonb_build_object('username',winner_name,'amount',50);
end $$;
revoke all on function public.draw_chat_reward() from public;
grant execute on function public.draw_chat_reward() to authenticated;
