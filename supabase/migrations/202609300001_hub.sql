-- Feature tables retain the existing CMS field names in JSONB during migration.
-- Rows, indexes, queries, access control, and atomic operations live in Postgres.
create schema if not exists hub_private;
revoke all on schema hub_private from public;
grant usage on schema hub_private to anon, authenticated;

do $$ declare t text; begin
  foreach t in array array['users','news','videos','marketplace_items','marketplace_purchases','market_restaurants','market_supermarkets','market_products','jobs','job_applications','tambayan_stickers','tambayan_chat','tambayan_config','tambayan_live','moments','arabic_word_rush_config','social_profiles','social_posts','social_reports','activities','budget_entries','calorie_entries','follows','likes','replies'] loop
    execute format('create table public.%I (parent_id text not null default '''', id text not null, data jsonb not null default ''{}'' check (jsonb_typeof(data) = ''object''), primary key(parent_id,id), check(length(id) between 1 and 200 and position(''/'' in id)=0))',t);
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
    execute format('grant select on public.%I to anon',t);
    execute format('create index on public.%I (parent_id,(data->''createdAt'') desc,id desc)',t);
    if t not in ('activities','budget_entries','calorie_entries','follows','likes','replies') then
      execute format('alter table public.%I add check (parent_id='''')',t);
    else
      execute format('alter table public.%I add check (parent_id<>'''')',t);
    end if;
  end loop;
end $$;

create unique index users_id on public.users(id);
create unique index profiles_id on public.social_profiles(id);
create unique index posts_id on public.social_posts(id);
create unique index profiles_username on public.social_profiles((data->>'username'));
alter table public.social_profiles add constraint profiles_owner foreign key(id) references public.users(id) on delete cascade;
alter table public.social_posts add column author_id text generated always as (data->>'uid') stored references public.social_profiles(id) on delete cascade;
alter table public.follows add foreign key(parent_id) references public.social_profiles(id) on delete cascade;
alter table public.follows add foreign key(id) references public.social_profiles(id) on delete cascade;
alter table public.follows add check(parent_id <> id);
alter table public.likes add foreign key(parent_id) references public.social_posts(id) on delete cascade;
alter table public.likes add foreign key(id) references public.users(id) on delete cascade;
alter table public.replies add foreign key(parent_id) references public.social_posts(id) on delete cascade;
create index social_posts_author_created on public.social_posts((data->'uid'),(data->'createdAt') desc,id desc);
create index social_reports_status_created on public.social_reports((data->'status'),(data->'createdAt'),id);
create index job_applications_owner on public.job_applications((data->'uid'));
create index market_products_store on public.market_products((data->'supermarketId'));
create index budget_owner_date on public.budget_entries(parent_id,(data->'date') desc);
create index calories_owner_date on public.calorie_entries(parent_id,(data->'date') desc,(data->'createdAt') desc);

create function hub_private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.users where id=(select auth.uid())::text and data->>'role'='admin');
$$;
revoke all on function hub_private.is_admin() from public;
grant execute on function hub_private.is_admin() to anon,authenticated;

create function hub_private.protect_account() returns trigger language plpgsql set search_path='' as $$
begin
  if current_user in ('anon','authenticated') then
    if (new.data - array['username','displayName','bio','photoPath','lastVisit']) is distinct from
       (old.data - array['username','displayName','bio','photoPath','lastVisit']) then
      raise exception 'Protected account fields cannot be edited' using errcode='42501';
    end if;
  end if;
  return new;
end $$;
create trigger protect_account before update on public.users for each row execute function hub_private.protect_account();
create policy account_read on public.users for select to authenticated using(id=(select auth.uid())::text or hub_private.is_admin());
create policy account_update on public.users for update to authenticated using(id=(select auth.uid())::text) with check(id=(select auth.uid())::text);

-- Deliberately expose only public ranking fields, never email or account roles.
create view public.leaderboard with (security_barrier=true) as
select parent_id,id,jsonb_build_object('username',data->'username','displayName',data->'displayName','points',data->'points') as data from public.users;
revoke all on public.leaderboard from public,anon,authenticated;
grant select on public.leaderboard to authenticated;

create function hub_private.create_account() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.users(id,data) values(new.id::text,jsonb_build_object(
    'email',new.email,'username',left(coalesce(new.raw_user_meta_data->>'username','kabayan'),20),
    'displayName',left(coalesce(new.raw_user_meta_data->>'displayName','Kabayan'),50),
    'role','user','points',0,'createdAt',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
  return new;
end $$;
revoke all on function hub_private.create_account() from public;
create trigger on_auth_user_created after insert on auth.users for each row execute function hub_private.create_account();

do $$ declare t text; begin
  foreach t in array array['news','videos','marketplace_items','market_restaurants','market_supermarkets','market_products','tambayan_stickers','tambayan_config','arabic_word_rush_config'] loop
    execute format('create policy public_read on public.%I for select using(true)',t);
    execute format('create policy admin_write on public.%I for all to authenticated using(hub_private.is_admin()) with check(hub_private.is_admin())',t);
  end loop;
  foreach t in array array['jobs','tambayan_live'] loop
    execute format('create policy member_read on public.%I for select to authenticated using(true)',t);
    execute format('create policy admin_write on public.%I for all to authenticated using(hub_private.is_admin()) with check(hub_private.is_admin())',t);
  end loop;
  foreach t in array array['budget_entries','calorie_entries'] loop
    execute format('create policy owner_only on public.%I for all to authenticated using(parent_id=(select auth.uid())::text) with check(parent_id=(select auth.uid())::text)',t);
  end loop;
end $$;
create policy activity_read on public.activities for select to authenticated using(parent_id=(select auth.uid())::text);
create policy purchase_read on public.marketplace_purchases for select to authenticated using(data->>'userId'=(select auth.uid())::text or hub_private.is_admin());
create policy purchase_admin on public.marketplace_purchases for update to authenticated using(hub_private.is_admin()) with check(hub_private.is_admin());
create policy application_read on public.job_applications for select to authenticated using(data->>'uid'=(select auth.uid())::text or hub_private.is_admin());
create policy application_create on public.job_applications for insert to authenticated with check(data->>'uid'=(select auth.uid())::text and data->>'status'='pending');
create policy application_update on public.job_applications for update to authenticated using(hub_private.is_admin() or (data->>'uid'=(select auth.uid())::text and data->>'status'='pending')) with check(hub_private.is_admin() or (data->>'uid'=(select auth.uid())::text and data->>'status'='pending'));
create policy application_delete on public.job_applications for delete to authenticated using(hub_private.is_admin());

-- Social profile writes are exclusively through the atomic save_profile RPC.
create policy profile_read on public.social_profiles for select using(true);
create policy posts_read on public.social_posts for select using(true);
create policy post_create on public.social_posts for insert to authenticated with check(data->>'uid'=(select auth.uid())::text and exists(select 1 from public.social_profiles where id=(select auth.uid())::text));
create policy post_delete on public.social_posts for delete to authenticated using(data->>'uid'=(select auth.uid())::text or hub_private.is_admin());
create policy follows_owner on public.follows for all to authenticated using(parent_id=(select auth.uid())::text) with check(parent_id=(select auth.uid())::text);
create policy likes_read on public.likes for select using(exists(select 1 from public.social_posts where id=likes.parent_id));
create policy likes_create on public.likes for insert to authenticated with check(id=(select auth.uid())::text and data->>'uid'=id);
create policy likes_delete on public.likes for delete to authenticated using(id=(select auth.uid())::text);
create policy replies_read on public.replies for select using(exists(select 1 from public.social_posts where id=replies.parent_id));
create policy replies_create on public.replies for insert to authenticated with check(data->>'uid'=(select auth.uid())::text and exists(select 1 from public.social_profiles where id=(select auth.uid())::text));
create policy replies_delete on public.replies for delete to authenticated using(data->>'uid'=(select auth.uid())::text or hub_private.is_admin());
create policy report_read on public.social_reports for select to authenticated using(data->>'uid'=(select auth.uid())::text or hub_private.is_admin());
create policy report_create on public.social_reports for insert to authenticated with check(data->>'uid'=(select auth.uid())::text and data->>'status'='open' and id=(data->>'postId')||'_'||(select auth.uid())::text and exists(select 1 from public.social_posts where id=social_reports.data->>'postId'));
create policy report_update on public.social_reports for update to authenticated using(hub_private.is_admin()) with check(hub_private.is_admin());

create policy chat_read on public.tambayan_chat for select to authenticated using(true);
create policy chat_create on public.tambayan_chat for insert to authenticated with check(data->>'uid'=(select auth.uid())::text);
create policy chat_delete on public.tambayan_chat for delete to authenticated using(hub_private.is_admin());
create policy moments_read on public.moments for select using(true);
create policy moments_create on public.moments for insert to authenticated with check(data->>'uid'=(select auth.uid())::text);
create policy moments_delete on public.moments for delete to authenticated using(data->>'uid'=(select auth.uid())::text or hub_private.is_admin());

create function hub_private.validate_content() returns trigger language plpgsql set search_path='' as $$
declare max_length integer; allowed text[];
begin
  if tg_op='INSERT' and tg_table_name in ('social_posts','replies','likes','follows','social_reports','tambayan_chat','moments') then
    new.data=jsonb_set(new.data,'{createdAt}',to_jsonb(to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
  end if;
  if tg_table_name in ('social_posts','replies','moments') then
    max_length=case tg_table_name when 'social_posts' then 500 when 'replies' then 280 else 220 end;
    if jsonb_typeof(new.data->'text') is distinct from 'string' or length(btrim(new.data->>'text')) not between 1 and max_length then raise exception 'Invalid text length'; end if;
  end if;
  if tg_table_name='social_posts' or tg_table_name='replies' then
    if new.data - array['uid','text','createdAt'] <> '{}'::jsonb then raise exception 'Invalid post fields'; end if;
  elsif tg_table_name='likes' then
    if new.data - array['uid','createdAt'] <> '{}'::jsonb then raise exception 'Invalid like'; end if;
  elsif tg_table_name='follows' then
    if new.data - 'createdAt' <> '{}'::jsonb then raise exception 'Invalid follow'; end if;
  elsif tg_table_name='social_reports' then
    if new.data->>'reason' not in ('spam','abuse','scam','other') or new.data->>'status' not in ('open','removed','reviewed') then raise exception 'Invalid report'; end if;
    if tg_op='UPDATE' and (new.data-array['status','reviewedAt']) is distinct from (old.data-array['status','reviewedAt']) then raise exception 'Report details are immutable'; end if;
  elsif tg_table_name='tambayan_chat' then
    if new.data->>'type'='text' then
      if jsonb_typeof(new.data->'text') is distinct from 'string' or length(btrim(new.data->>'text')) not between 1 and 220 then raise exception 'Invalid chat text'; end if;
    elsif new.data->>'type'='sticker' then
      if length(coalesce(new.data->>'stickerId','')) not between 1 and 64 then raise exception 'Invalid sticker'; end if;
    else raise exception 'Invalid message type'; end if;
  end if;
  if tg_table_name in ('tambayan_chat','moments') and coalesce(new.data->>'text','') ~* '(https?://|www\.|\.(com|net|org|io|app|co|me|sa|ph)\y)' then raise exception 'Links are not allowed in chat or moments'; end if;
  if tg_table_name='moments' and (new.data->>'expiresAt')::timestamptz > now()+interval '8 days' then raise exception 'Invalid expiry'; end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['social_posts','replies','likes','follows','social_reports','tambayan_chat','moments'] loop
    execute format('create trigger validate_content before insert or update on public.%I for each row execute function hub_private.validate_content()',t);
  end loop;
end $$;

create function public.save_profile(p_username text,p_display_name text,p_bio text,p_photo_path text) returns void language plpgsql security definer set search_path='' as $$
declare u text=auth.uid()::text; profile jsonb; previous jsonb; stamp text=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if u is null then raise exception 'Sign in first' using errcode='42501'; end if;
  p_username=lower(btrim(p_username)); p_display_name=btrim(p_display_name); p_bio=btrim(p_bio);
  if p_username is null or p_display_name is null or p_bio is null or p_photo_path is null or p_username !~ '^[a-z0-9_]{3,20}$' or length(p_display_name) not between 1 and 50 or length(p_bio)>160 or p_photo_path not in ('','social/avatars/'||u||'/avatar.jpg') then raise exception 'Invalid profile'; end if;
  perform 1 from public.users where id=u for update;
  if not found then raise exception 'Account missing'; end if;
  select data into previous from public.social_profiles where id=u;
  profile=jsonb_build_object('username',p_username,'displayName',p_display_name,'bio',p_bio,'photoPath',p_photo_path,'createdAt',coalesce(previous->>'createdAt',stamp),'updatedAt',stamp);
  insert into public.social_profiles(id,data) values(u,profile) on conflict(parent_id,id) do update set data=excluded.data;
  update public.users set data=data||(profile-'createdAt') where id=u;
end $$;
revoke all on function public.save_profile(text,text,text,text) from public;
grant execute on function public.save_profile(text,text,text,text) to authenticated;

-- Server-side document interface. Dynamic identifiers are checked against a fixed list.
create function hub_private.check_table(t text) returns void language plpgsql immutable set search_path='' as $$
begin
 if t is null or t <> all(array['users','leaderboard','news','videos','marketplace_items','marketplace_purchases','market_restaurants','market_supermarkets','market_products','jobs','job_applications','tambayan_stickers','tambayan_chat','tambayan_config','tambayan_live','moments','arabic_word_rush_config','social_profiles','social_posts','social_reports','activities','budget_entries','calorie_entries','follows','likes','replies']) then raise exception 'Unknown table'; end if;
end $$;
create function hub_private.resolve_value(v jsonb,previous jsonb) returns jsonb language plpgsql set search_path='' as $$
declare result jsonb='{}'; k text; item jsonb;
begin
 if v->>'__hub_op'='timestamp' then return to_jsonb(to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')); end if;
 if v->>'__hub_op'='increment' then return to_jsonb(coalesce((previous#>>'{}')::numeric,0)+(v->>'amount')::numeric); end if;
 if jsonb_typeof(v)='object' then
  for k,item in select * from jsonb_each(v) loop result=result||jsonb_build_object(k,hub_private.resolve_value(item,previous->k)); end loop;
  return result;
 end if;
 return v;
end $$;
create function public.hub_write(p_table text,p_parent text,p_id text,p_data jsonb,p_mode text) returns void language plpgsql security invoker set search_path='' as $$
declare old_data jsonb; final_data jsonb; affected integer;
begin
 perform hub_private.check_table(p_table);
 if p_mode not in ('set','merge','update','delete') then raise exception 'Unknown operation'; end if;
 execute format('select data from public.%I where parent_id=$1 and id=$2 for update',p_table) into old_data using p_parent,p_id;
 if p_mode='delete' then
  execute format('delete from public.%I where parent_id=$1 and id=$2',p_table) using p_parent,p_id; return;
 end if;
 if p_mode='update' and old_data is null then raise exception 'Record missing or not accessible'; end if;
 final_data=hub_private.resolve_value(p_data,old_data);
 if p_mode in ('merge','update') then final_data=coalesce(old_data,'{}')||final_data; end if;
 if old_data is not null then
  execute format('update public.%I set data=$3 where parent_id=$1 and id=$2',p_table) using p_parent,p_id,final_data;
  get diagnostics affected=row_count;
  if affected=0 then raise exception 'Update denied' using errcode='42501'; end if;
 else
  execute format('insert into public.%I(parent_id,id,data) values($1,$2,$3)',p_table) using p_parent,p_id,final_data;
 end if;
end $$;
revoke all on function public.hub_write(text,text,text,jsonb,text) from public;
grant execute on function public.hub_write(text,text,text,jsonb,text) to authenticated;

create function public.hub_query(p_table text,p_parent text,p_constraints jsonb default '[]') returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare c jsonb; o jsonb; v jsonb; field text; expr text; clause text='parent_id=$1'; ordering text=''; orders jsonb='[]'; cursor_values jsonb; cursor_sql text=''; equal_prefix text=''; comparison text; take integer=1000; result jsonb; idx integer=0;
begin
 perform hub_private.check_table(p_table);
 if jsonb_typeof(p_constraints)<>'array' or jsonb_array_length(p_constraints)>30 then raise exception 'Invalid query'; end if;
 for c in select value from jsonb_array_elements(p_constraints) loop
  field=c->>'field';
  if field is not null and field !~ '^[A-Za-z_][A-Za-z0-9_]*$' then raise exception 'Invalid field'; end if;
  expr=case when field='__name__' then 'to_jsonb(id)' else format('(data->%L)',field) end;
  if c->>'kind'='where' then
    if c->>'op'='in' then
      if jsonb_typeof(c->'value')<>'array' then raise exception 'Invalid in filter'; end if;
      clause=clause||format(' and %s in (select value from jsonb_array_elements(%L::jsonb))',expr,c->'value');
    elsif c->>'op' in ('==','!=','>','>=','<','<=') then
      clause=clause||format(' and %s %s %L::jsonb',expr,case c->>'op' when '==' then '=' when '!=' then '<>' else c->>'op' end,c->'value');
    else raise exception 'Unknown query operator'; end if;
  elsif c->>'kind'='order' then
    if c->>'direction' not in ('asc','desc') then raise exception 'Invalid direction'; end if;
    orders=orders||jsonb_build_array(c);
  elsif c->>'kind'='limit' then take=greatest(1,least(1000,(c->>'count')::integer));
  elsif c->>'kind'='cursor' then cursor_values=c->'values';
  else raise exception 'Unknown query constraint'; end if;
 end loop;
 if not exists(select 1 from jsonb_array_elements(orders) x where x->>'field'='__name__') then
  orders=orders||jsonb_build_array(jsonb_build_object('field','__name__','direction',coalesce(orders->-1->>'direction','asc')));
 end if;
 for o in select value from jsonb_array_elements(orders) loop
  expr=case when o->>'field'='__name__' then 'to_jsonb(id)' else format('(data->%L)',o->>'field') end;
  ordering=ordering||case when ordering='' then '' else ',' end||expr||' '||(o->>'direction');
  clause=clause||' and '||expr||' is not null';
  if cursor_values is not null and idx<jsonb_array_length(cursor_values) then
    comparison=case when o->>'direction'='desc' then '<' else '>' end;
    cursor_sql=cursor_sql||case when cursor_sql='' then '' else ' or ' end||'('||equal_prefix||format('%s %s %L::jsonb',expr,comparison,cursor_values->idx)||')';
    equal_prefix=equal_prefix||format('%s = %L::jsonb and ',expr,cursor_values->idx);
  end if;
  idx=idx+1;
 end loop;
 if cursor_sql<>'' then clause=clause||' and ('||cursor_sql||')'; end if;
 execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from (select id,data from public.%I where %s order by %s limit %s) r',p_table,clause,ordering,take) into result using p_parent;
 return result;
end $$;
revoke all on function public.hub_query(text,text,jsonb) from public;
grant execute on function public.hub_query(text,text,jsonb) to anon,authenticated;

-- No browser can choose a reward amount or overwrite a point balance.
create function public.claim_reward(p_type text,p_ref text default '',p_score integer default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare u text=auth.uid()::text; account jsonb; source jsonb; reward integer; claim_id text; stamp text=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'); extra jsonb='{}';
begin
 if u is null then raise exception 'Sign in first' using errcode='42501'; end if;
 if p_type is null or p_ref is null or p_score is null then raise exception 'Invalid claim'; end if;
 select data into account from public.users where id=u for update;
 if account is null then raise exception 'Account missing'; end if;
 if p_type in ('news_read','news_share','video_watched','video_share') then
  if p_type like 'news_%' then select data into source from public.news where id=p_ref;
  else select data into source from public.videos where id=p_ref; end if;
  if source is null then raise exception 'Content unavailable'; end if;
  reward=case when p_type in ('news_share','video_share') then coalesce((source->>'shareReward')::integer,5) else coalesce((source->>'reward')::integer,10) end;
  claim_id=p_type||'_'||p_ref;
 elsif p_type='daily_checkin' then
  reward=5; claim_id=p_type||'_'||to_char(now() at time zone 'Asia/Riyadh','YYYY-MM-DD');
  extra=jsonb_build_object('lastDailyCheckin',stamp);
 elsif p_type='arabic_quiz' then
  if coalesce((account->>'lastArabicQuiz')::timestamptz,'epoch')>now()-interval '7 days' then raise exception 'Already claimed this week'; end if;
  if p_score not between 0 and 10 then raise exception 'Invalid score'; end if;
  reward=25; claim_id=p_type||'_'||stamp; extra=jsonb_build_object('lastArabicQuiz',stamp,'arabicQuizScore',p_score);
 elsif p_type='arabicWordRush' then
  if p_ref<>to_char(now() at time zone 'Asia/Riyadh','IYYY-"W"IW') or p_score<30 then raise exception 'Invalid weekly claim'; end if;
  select data into source from public.arabic_word_rush_config where id=p_ref;
  reward=coalesce((source->>'rewardKp')::integer,30); claim_id=p_type||'_'||p_ref;
 else raise exception 'Unsupported reward'; end if;
 if exists(select 1 from public.activities where parent_id=u and id=claim_id) then return jsonb_build_object('awarded',false,'points',account->'points','amount',0); end if;
 if reward not between 0 and 10000 then raise exception 'Invalid reward configuration'; end if;
 insert into public.activities(parent_id,id,data) values(u,claim_id,jsonb_build_object('type',p_type,'refId',p_ref,'newsId',p_ref,'amount',reward,'points',reward,'score',p_score,'createdAt',stamp));
 update public.users set data=data||extra||jsonb_build_object('points',coalesce((data->>'points')::integer,0)+reward,'lastVisit',stamp) where id=u returning data into account;
 return jsonb_build_object('awarded',true,'points',account->'points','amount',reward);
end $$;
revoke all on function public.claim_reward(text,text,integer) from public;
grant execute on function public.claim_reward(text,text,integer) to authenticated;

create function public.redeem_item(p_item_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u text=auth.uid()::text; account jsonb; item jsonb; price integer; stock integer; purchase_id text=gen_random_uuid()::text; stamp text=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
 if u is null then raise exception 'Sign in first' using errcode='42501'; end if;
 select data into account from public.users where id=u for update;
 select data into item from public.marketplace_items where id=p_item_id for update;
 if account is null or item is null then raise exception 'Item or account missing'; end if;
 price=coalesce((item->>'price')::integer,50); stock=(item->>'stock')::integer;
 if price<0 or coalesce((account->>'points')::integer,0)<price then raise exception 'Not enough Kabayan Points'; end if;
 if stock is not null and stock<=0 then raise exception 'Item sold out'; end if;
 update public.users set data=data||jsonb_build_object('points',(data->>'points')::integer-price,'lastVisit',stamp) where id=u returning data into account;
 if stock is not null then update public.marketplace_items set data=data||jsonb_build_object('stock',stock-1) where id=p_item_id; end if;
 insert into public.marketplace_purchases(id,data) values(purchase_id,jsonb_build_object('userId',u,'userEmail',account->'email','userDisplayName',account->'displayName','itemId',p_item_id,'itemTitle',item->'title','price',price,'status','pending','redeemedAt',null,'createdAt',stamp));
 insert into public.activities(parent_id,id,data) values(u,purchase_id,jsonb_build_object('type','market_redeem','refId',p_item_id,'title',item->'title','amount',-price,'createdAt',stamp));
 return jsonb_build_object('points',account->'points','stock',case when stock is null then null else stock-1 end,'price',price);
end $$;
revoke all on function public.redeem_item(text) from public;
grant execute on function public.redeem_item(text) to authenticated;

-- Restrict helper execution to the roles that need invoker functions/RLS.
revoke all on all functions in schema hub_private from public;
grant execute on function hub_private.is_admin(),hub_private.check_table(text),hub_private.resolve_value(jsonb,jsonb) to anon,authenticated;
