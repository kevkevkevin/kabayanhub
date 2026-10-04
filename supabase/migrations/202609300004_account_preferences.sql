-- Tracker preferences remain editable; identity edits use save_profile and roles
-- and points remain accessible only through trusted database operations.
create or replace function hub_private.protect_account() returns trigger language plpgsql set search_path='' as $$
begin
  if current_user in ('anon','authenticated') then
    if (new.data - array['lastVisit','budgetTargetMonthly','budgetCurrency','calorieGoalDaily','proteinGoalDaily']) is distinct from
       (old.data - array['lastVisit','budgetTargetMonthly','budgetCurrency','calorieGoalDaily','proteinGoalDaily']) then
      raise exception 'Protected account fields cannot be edited' using errcode='42501';
    end if;
    if new.data ? 'budgetCurrency' and new.data->>'budgetCurrency' not in ('PHP','SAR') then raise exception 'Invalid currency'; end if;
  end if;
  return new;
end $$;

alter table public.users add column auth_user_id uuid generated always as (id::uuid) stored references auth.users(id) on delete cascade;
alter table public.activities add foreign key(parent_id) references public.users(id) on delete cascade;
alter table public.budget_entries add foreign key(parent_id) references public.users(id) on delete cascade;
alter table public.calorie_entries add foreign key(parent_id) references public.users(id) on delete cascade;
alter table public.replies add column author_id text generated always as (data->>'uid') stored references public.social_profiles(id) on delete cascade;

-- Preserve the existing optional Tambayan lottery without client-side balance
-- writes or multiple awards from different open browser windows.
create table hub_private.chat_reward_rounds(round_at timestamptz primary key,winner text not null);
create function public.draw_chat_reward() returns jsonb language plpgsql security definer set search_path='' as $$
declare round_at timestamptz=to_timestamp(floor(extract(epoch from now())/600)*600); winner_id text; winner_name text; stamp text=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
 if auth.uid() is null then raise exception 'Sign in first' using errcode='42501'; end if;
 if not exists(select 1 from public.tambayan_config where id='display' and data->>'earningPointsEnabled'='true') then return null; end if;
 perform pg_advisory_xact_lock(601301);
 if exists(select 1 from hub_private.chat_reward_rounds r where r.round_at=draw_chat_reward.round_at) then return null; end if;
 select eligible.uid into winner_id from (
  select distinct data->>'uid' as uid from public.tambayan_chat
  where (data->>'createdAt')::timestamptz>=round_at-interval '20 minutes' and (data->>'createdAt')::timestamptz<round_at-interval '10 minutes'
 ) eligible join public.users u on u.id=eligible.uid order by random() limit 1;
 if winner_id is null then return null; end if;
 insert into hub_private.chat_reward_rounds values(round_at,winner_id);
 update public.users set data=data||jsonb_build_object('points',coalesce((data->>'points')::integer,0)+50) where id=winner_id returning coalesce(data->>'username','Kabayan') into winner_name;
 insert into public.activities(parent_id,id,data) values(winner_id,'chat_'||extract(epoch from round_at)::bigint,jsonb_build_object('type','chat_reward','amount',50,'createdAt',stamp));
 return jsonb_build_object('username',winner_name,'amount',50);
end $$;
revoke all on function public.draw_chat_reward() from public;
grant execute on function public.draw_chat_reward() to authenticated;
