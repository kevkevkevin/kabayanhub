-- Both currencies and marketplace items are play-only, with no real-world value.
create table public.arcade_conversions (
 user_id uuid not null references public.arcade_wallets(user_id) on delete cascade,
 request_id uuid not null,
 result jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(user_id,request_id)
);
alter table public.arcade_conversions enable row level security;
revoke all on public.arcade_conversions from public,anon,authenticated;
grant select on public.arcade_conversions to authenticated;
create policy own_read on public.arcade_conversions for select to authenticated using(user_id=(select auth.uid()));
alter table public.arcade_transactions drop constraint arcade_transactions_kind_check;
alter table public.arcade_transactions add constraint arcade_transactions_kind_check check(kind in ('starter','daily_refill','round','conversion'));

create function public.convert_arcade_coins(p_request_id uuid,p_coins integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid=auth.uid(); w public.arcade_wallets; account jsonb; previous jsonb; result jsonb; earned integer; total bigint;
 stamp text=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
 if u is null then raise exception 'Sign in first' using errcode='42501'; end if;
 if p_request_id is null or p_coins is null or p_coins<10 or p_coins>1000000 or p_coins%10<>0 then
  raise exception 'Choose a multiple of 10 coins, up to 1,000,000';
 end if;
 perform hub_private.ensure_arcade_wallet(u);
 select * into w from public.arcade_wallets where user_id=u for update;
 select c.result into previous from public.arcade_conversions c where c.user_id=u and c.request_id=p_request_id;
 if previous is not null then return previous; end if;
 select data into account from public.users where id=u::text for update;
 if account is null then raise exception 'Account missing'; end if;
 if w.balance<p_coins then raise exception 'Not enough Kabayan Coins'; end if;
 earned=p_coins/10; total=coalesce((account->>'points')::bigint,0)+earned;
 if total>2147483647 then raise exception 'KP balance limit reached'; end if;
 update public.arcade_wallets set balance=balance-p_coins,updated_at=clock_timestamp() where user_id=u returning * into w;
 update public.users set data=data||jsonb_build_object('points',total,'lastVisit',stamp) where id=u::text;
 insert into public.arcade_transactions(user_id,kind,amount,balance,round_id) values(u,'conversion',-p_coins,w.balance,p_request_id);
 insert into public.activities(parent_id,id,data) values(u::text,'coin_conversion_'||p_request_id,
  jsonb_build_object('type','coin_conversion','amount',earned,'coins',p_coins,'createdAt',stamp));
 result=jsonb_build_object('id',p_request_id,'coins',p_coins,'earned',earned,'balance',w.balance,'points',total,'createdAt',stamp);
 insert into public.arcade_conversions(user_id,request_id,result) values(u,p_request_id,result);
 return result;
end $$;
revoke all on function public.convert_arcade_coins(uuid,integer) from public,anon,authenticated;
grant execute on function public.convert_arcade_coins(uuid,integer) to authenticated;

-- Collect a virtual item immediately; no external fulfillment or physical prize.
create or replace function public.redeem_item(p_item_id text) returns jsonb language plpgsql security definer set search_path='' as $$
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
 insert into public.marketplace_purchases(id,data) values(purchase_id,jsonb_build_object('userId',u,'userEmail',account->'email','userDisplayName',account->'displayName','itemId',p_item_id,'itemTitle',item->'title','price',price,'status','redeemed','virtualOnly',true,'redeemedAt',stamp,'createdAt',stamp));
 insert into public.activities(parent_id,id,data) values(u,purchase_id,jsonb_build_object('type','market_redeem','refId',p_item_id,'title',item->'title','amount',-price,'createdAt',stamp));
 return jsonb_build_object('points',account->'points','stock',case when stock is null then null else stock-1 end,'price',price);
end $$;
