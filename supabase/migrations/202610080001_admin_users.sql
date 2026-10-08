-- Admin user management. No browser receives the service-role key.
create table public.admin_user_audit (
 request_id uuid primary key,
 actor_id uuid not null,
 target_id uuid not null,
 action text not null check(action in ('balances','block','unblock','delete')),
 reason text not null,
 before_state jsonb not null,
 after_state jsonb not null,
 outcome text not null default 'completed',
 created_at timestamptz not null default clock_timestamp()
);
alter table public.admin_user_audit enable row level security;
revoke all on public.admin_user_audit from public,anon,authenticated;
grant select on public.admin_user_audit to authenticated;
grant all on public.admin_user_audit to service_role;

create function hub_private.account_active() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.users where id=auth.uid()::text and coalesce(data->>'blocked','false')<>'true');
$$;
revoke all on function hub_private.account_active() from public,anon;
grant execute on function hub_private.account_active() to authenticated;
create or replace function hub_private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.users where id=auth.uid()::text and data->>'role'='admin' and coalesce(data->>'blocked','false')<>'true');
$$;
create policy admin_read on public.admin_user_audit for select to authenticated using(hub_private.is_admin());

-- Restrictive policies also apply to an existing JWT after an account is blocked.
-- Triggers cover SECURITY DEFINER writes that intentionally bypass RLS.
create function hub_private.guard_active_account() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and not hub_private.account_active() then raise exception 'This account is blocked or no longer exists' using errcode='42501'; end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function hub_private.guard_active_account() from public,anon,authenticated;
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname='public' and tablename in
 ('users','news','videos','marketplace_items','marketplace_purchases','market_restaurants','market_supermarkets','market_products','jobs','job_applications','tambayan_stickers','tambayan_chat','tambayan_config','tambayan_live','moments','arabic_word_rush_config','social_profiles','social_posts','social_reports','activities','budget_entries','calorie_entries','follows','likes','replies','leaderboard','typing_rounds','arcade_wallets','arcade_game_states','arcade_rounds','arcade_transactions','arcade_conversions') loop
  execute format('create policy active_account on public.%I as restrictive for all to authenticated using(hub_private.account_active()) with check(hub_private.account_active())',t);
  execute format('create trigger active_account_guard before insert or update or delete on public.%I for each row execute function hub_private.guard_active_account()',t);
 end loop;
 if to_regclass('storage.objects') is not null then
  execute 'create policy hub_active_account on storage.objects as restrictive for all to authenticated using(hub_private.account_active()) with check(hub_private.account_active())';
 end if;
end $$;

create function public.admin_list_users(p_search text default '',p_page integer default 0,p_status text default 'all') returns jsonb language plpgsql security definer set search_path='' as $$
declare results jsonb; total integer;
begin
 if not hub_private.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_page is null or p_page<0 or p_page>100000 or p_status is null or p_status not in ('all','active','blocked') or p_search is null or length(p_search)>100 then raise exception 'Invalid user filter'; end if;
 select count(*) into total from public.users u join auth.users a on a.id=u.auth_user_id
 where (p_status='all' or (coalesce(u.data->>'blocked','false')='true')=(p_status='blocked'))
 and (p_search='' or strpos(lower(coalesce(a.email,'')||' '||coalesce(u.data->>'username','')||' '||coalesce(u.data->>'displayName','')||' '||u.id),lower(p_search))>0);
 select coalesce(jsonb_agg(r),'[]'::jsonb) into results from (
  select u.id,a.email,u.data->>'username' as username,u.data->>'displayName' as "displayName",u.data->>'role' as role,
   coalesce((u.data->>'points')::bigint,0) as points,coalesce(w.balance,1000) as coins,
   w.user_id is not null as "walletInitialized",coalesce(u.data->>'blocked','false')='true' as blocked,
   coalesce(u.data->>'deleting','false')='true' as deleting,a.created_at as "createdAt",a.last_sign_in_at as "lastSignInAt",a.email_confirmed_at is not null as confirmed
  from public.users u join auth.users a on a.id=u.auth_user_id left join public.arcade_wallets w on w.user_id=a.id
  where (p_status='all' or (coalesce(u.data->>'blocked','false')='true')=(p_status='blocked'))
   and (p_search='' or strpos(lower(coalesce(a.email,'')||' '||coalesce(u.data->>'username','')||' '||coalesce(u.data->>'displayName','')||' '||u.id),lower(p_search))>0)
  order by a.created_at desc,u.id limit 25 offset p_page*25
 ) r;
 return jsonb_build_object('users',results,'total',total,'page',p_page,'pageSize',25);
end $$;
revoke all on function public.admin_list_users(text,integer,text) from public,anon;
grant execute on function public.admin_list_users(text,integer,text) to authenticated;

alter table public.arcade_transactions drop constraint arcade_transactions_kind_check;
alter table public.arcade_transactions add constraint arcade_transactions_kind_check check(kind in ('starter','daily_refill','round','conversion','admin_adjustment'));

create function public.admin_user_action(p_request_id uuid,p_target uuid,p_action text,p_values jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid=auth.uid(); target jsonb; w public.arcade_wallets; prior public.admin_user_audit; before_data jsonb; after_data jsonb;
 reason text=trim(p_values->>'reason'); points bigint; coins bigint; stamp text=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
 if not hub_private.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_request_id is null or p_target is null or p_action is null or p_action not in ('balances','block','unblock','delete') or reason is null or length(reason) not between 1 and 250 then raise exception 'Choose an action and provide a reason (up to 250 characters)'; end if;
 -- Consistent wallet -> profile lock order matches gameplay and conversion.
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 select * into prior from public.admin_user_audit where request_id=p_request_id;
 if found then
  if prior.actor_id<>actor or prior.target_id<>p_target or prior.action<>p_action then raise exception 'Request ID already used'; end if;
  return prior.after_state;
 end if;
 perform hub_private.ensure_arcade_wallet(p_target);
 select * into w from public.arcade_wallets where user_id=p_target for update;
 select data into target from public.users where id=p_target::text for update;
 if target is null then raise exception 'Account not found'; end if;
 if p_action<>'balances' and (p_target=actor or target->>'role'='admin') then raise exception 'Administrator accounts cannot be blocked or deleted here' using errcode='42501'; end if;
 if target->>'deleting'='true' and p_action<>'delete' then raise exception 'Deletion is in progress. Retry deletion to finish'; end if;
 points=coalesce((target->>'points')::bigint,0); coins=w.balance;
 before_data=jsonb_build_object('points',points,'coins',coins,'blocked',coalesce(target->>'blocked','false')='true');
 if p_action='balances' then
  if p_values->>'points' is null or p_values->>'coins' is null or p_values->>'expectedPoints' is null or p_values->>'expectedCoins' is null
    or (p_values->>'points') !~ '^\d+$' or (p_values->>'coins') !~ '^\d+$' then raise exception 'Enter whole, nonnegative balances'; end if;
  if points<>(p_values->>'expectedPoints')::bigint or coins<>(p_values->>'expectedCoins')::bigint then raise exception 'Balances changed. Refresh the user and try again' using errcode='40001'; end if;
  points=(p_values->>'points')::bigint; coins=(p_values->>'coins')::bigint;
  if points not between 0 and 1000000000 or coins not between 0 and 1000000000 then raise exception 'Balances must be between 0 and 1,000,000,000'; end if;
  update public.users set data=data||jsonb_build_object('points',points) where id=p_target::text;
  update public.arcade_wallets set balance=coins,updated_at=clock_timestamp() where user_id=p_target;
  if coins<>w.balance then insert into public.arcade_transactions(user_id,kind,amount,balance,round_id) values(p_target,'admin_adjustment',coins-w.balance,coins,p_request_id); end if;
  if points<>coalesce((target->>'points')::bigint,0) then
   insert into public.activities(parent_id,id,data) values(p_target::text,'admin_'||p_request_id,jsonb_build_object('type','admin_adjustment','amount',points-coalesce((target->>'points')::bigint,0),'createdAt',stamp));
  end if;
 else
  update public.users set data=data||jsonb_build_object('blocked',p_action<>'unblock','deleting',p_action='delete') where id=p_target::text;
 end if;
 after_data=jsonb_build_object('points',points,'coins',coins,'blocked',case when p_action='balances' then coalesce(target->>'blocked','false')='true' else p_action<>'unblock' end,'deleting',p_action='delete');
 insert into public.admin_user_audit(request_id,actor_id,target_id,action,reason,before_state,after_state,outcome)
 values(p_request_id,actor,p_target,p_action,reason,before_data,after_data,case when p_action='balances' then 'completed' else 'pending' end);
 return after_data;
end $$;
revoke all on function public.admin_user_action(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.admin_user_action(uuid,uuid,text,jsonb) to authenticated;

-- Remove remaining document-shaped records when Auth deletes an account.
create function hub_private.cleanup_deleted_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from public.job_applications where data->>'uid'=old.id::text;
 delete from public.marketplace_purchases where data->>'userId'=old.id::text;
 delete from public.social_reports where data->>'uid'=old.id::text or data->>'postId' in (select id from public.social_posts where data->>'uid'=old.id::text);
 delete from public.tambayan_chat where data->>'uid'=old.id::text;
 delete from public.moments where data->>'uid'=old.id::text;
 delete from hub_private.chat_reward_rounds where winner=old.id::text;
 return old;
end $$;
revoke all on function hub_private.cleanup_deleted_user() from public,anon,authenticated;
create trigger cleanup_hub_user before delete on auth.users for each row execute function hub_private.cleanup_deleted_user();

-- A service-verified typing replay must not credit a blocked target account.
do $$ declare definition text; begin
 select pg_get_functiondef('public.credit_typing_round(uuid,uuid,integer)'::regprocedure) into definition;
 definition=replace(definition, 'if account is null then raise exception ''Account missing''; end if;',
 'if account is null then raise exception ''Account missing''; end if; if account->>''blocked''=''true'' then raise exception ''Account blocked'' using errcode=''42501''; end if;');
 execute definition;
 select pg_get_functiondef('public.draw_chat_reward()'::regprocedure) into definition;
 definition=replace(definition, 'eligible join public.users u on u.id=eligible.uid order by random()',
 'eligible join public.users u on u.id=eligible.uid where coalesce(u.data->>''blocked'',''false'')<>''true'' order by random()');
 execute definition;
end $$;
