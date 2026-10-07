-- Free, non-transferable arcade currency. Never convertible to Kabayan Points.
create table public.arcade_wallets (
 user_id uuid primary key references auth.users(id) on delete cascade,
 balance bigint not null default 1000 check(balance>=0),
 last_refill date,
 updated_at timestamptz not null default clock_timestamp()
);
create table public.arcade_game_states (
 user_id uuid not null references public.arcade_wallets(user_id) on delete cascade,
 game_id text not null,
 bonus_spins integer not null default 0 check(bonus_spins between 0 and 50),
 bonus_stake integer not null default 10,
 multiplier integer not null default 0,
 primary key(user_id,game_id)
);
create table public.arcade_rounds (
 user_id uuid not null references public.arcade_wallets(user_id) on delete cascade,
 request_id uuid not null,
 game_id text not null,
 result jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(user_id,request_id)
);
create index arcade_rounds_recent on public.arcade_rounds(user_id,game_id,created_at desc);
create table public.arcade_transactions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.arcade_wallets(user_id) on delete cascade,
 game_id text,
 kind text not null check(kind in ('starter','daily_refill','round')),
 amount bigint not null,
 balance bigint not null,
 round_id uuid,
 created_at timestamptz not null default clock_timestamp()
);
create index arcade_transactions_recent on public.arcade_transactions(user_id,created_at desc);
do $$ declare t text; begin
 foreach t in array array['arcade_wallets','arcade_game_states','arcade_rounds','arcade_transactions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy own_read on public.%I for select to authenticated using(user_id=(select auth.uid()))',t);
 end loop;
end $$;

create function hub_private.ensure_arcade_wallet(u uuid) returns void language plpgsql security definer set search_path='' as $$
declare added uuid;
begin
 if u is null then raise exception 'Sign in to use Kabayan Coin' using errcode='42501'; end if;
 insert into public.arcade_wallets(user_id) values(u) on conflict do nothing returning user_id into added;
 if added is not null then
  insert into public.arcade_transactions(user_id,kind,amount,balance) values(u,'starter',1000,1000);
 end if;
 insert into public.arcade_game_states(user_id,game_id) values(u,'kabayan-cascade') on conflict do nothing;
end $$;

create function public.get_arcade_wallet() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid=auth.uid(); w public.arcade_wallets; g public.arcade_game_states; recent jsonb; last_round jsonb;
begin
 perform hub_private.ensure_arcade_wallet(u);
 select * into w from public.arcade_wallets where user_id=u;
 select * into g from public.arcade_game_states where user_id=u and game_id='kabayan-cascade';
 select result into last_round from public.arcade_rounds where user_id=u and game_id='kabayan-cascade' order by created_at desc limit 1;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into recent from
  (select id,kind,game_id,amount,balance,created_at from public.arcade_transactions where user_id=u order by created_at desc limit 8) r;
 return jsonb_build_object('balance',w.balance,'canRefill',w.last_refill is distinct from (clock_timestamp() at time zone 'Asia/Riyadh')::date,
 'bonusSpins',g.bonus_spins,'bonusStake',g.bonus_stake,'bonusMultiplier',g.multiplier,'lastRound',last_round,'history',recent);
end $$;

create function public.refill_arcade_wallet() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid=auth.uid(); w public.arcade_wallets; today date=(clock_timestamp() at time zone 'Asia/Riyadh')::date;
begin
 perform hub_private.ensure_arcade_wallet(u);
 select * into w from public.arcade_wallets where user_id=u for update;
 if w.last_refill is distinct from today then
  update public.arcade_wallets set balance=balance+500,last_refill=today,updated_at=clock_timestamp() where user_id=u returning * into w;
  insert into public.arcade_transactions(user_id,kind,amount,balance) values(u,'daily_refill',500,w.balance);
 end if;
 return public.get_arcade_wallet();
end $$;

-- Eight ordinary symbols and a rare mascot scatter. No client-supplied outcomes.
create function hub_private.arcade_symbol() returns integer language plpgsql volatile set search_path='' as $$
declare r double precision=random();
begin
 return case when r<0.20 then 0 when r<0.38 then 1 when r<0.54 then 2 when r<0.68 then 3
 when r<0.80 then 4 when r<0.89 then 5 when r<0.95 then 6 when r<0.98 then 7 else 8 end;
end $$;

create function hub_private.arcade_matches(board jsonb,stake integer) returns jsonb language plpgsql immutable set search_path='' as $$
declare symbol integer; qty integer; factor integer; base integer; coins integer; total integer=0; positions jsonb='[]'; wins jsonb='[]'; hit jsonb;
begin
 for symbol in 0..7 loop
  select count(*),coalesce(jsonb_agg(ordinality-1),'[]'::jsonb) into qty,hit from jsonb_array_elements(board) with ordinality where value=to_jsonb(symbol);
  if qty>=8 then
   factor=case when qty>=12 then 3 when qty>=10 then 2 else 1 end;
   base=(array[10,20,30,40,50,80,120,200])[symbol+1];
   coins=greatest(1,stake*base*factor/100); total=total+coins; positions=positions||hit;
   wins=wins||jsonb_build_array(jsonb_build_object('symbol',symbol,'count',qty,'coins',coins));
  end if;
 end loop;
 return jsonb_build_object('positions',positions,'wins',wins,'coins',total);
end $$;

create function public.play_kabayan_cascade(p_request_id uuid,p_stake integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid=auth.uid(); w public.arcade_wallets; g public.arcade_game_states; previous jsonb; result jsonb;
 board jsonb='[]'; next_board jsonb; survivors jsonb; stage jsonb; stages jsonb='[]'; hits jsonb;
 i integer; c integer; r integer; step integer; bonus boolean; stake integer; cost integer; base_win integer=0;
 boost integer=0; round_multiplier integer; win integer; scatters integer=0; added integer=0; remaining integer; capped boolean=false;
begin
 if p_request_id is null or p_stake is null or p_stake not in (10,25,50,100) then raise exception 'Choose 10, 25, 50, or 100 coins'; end if;
 perform hub_private.ensure_arcade_wallet(u);
 -- All future arcade games must lock this same wallet before spending coins.
 select * into w from public.arcade_wallets where user_id=u for update;
 select ar.result into previous from public.arcade_rounds ar where ar.user_id=u and ar.request_id=p_request_id;
 if previous is not null then return previous; end if;
 if exists(select 1 from public.arcade_rounds where user_id=u and created_at>clock_timestamp()-interval '800 milliseconds') then raise exception 'Please wait a moment before another round'; end if;
 select * into g from public.arcade_game_states where user_id=u and game_id='kabayan-cascade' for update;
 bonus=g.bonus_spins>0; stake=case when bonus then g.bonus_stake else p_stake end; cost=case when bonus then 0 else stake end;
 if w.balance<cost then raise exception 'Not enough Kabayan Coins. Claim your daily free refill when available.'; end if;
 round_multiplier=case when bonus then g.multiplier else 0 end;
 for i in 1..30 loop board=board||to_jsonb(hub_private.arcade_symbol()); end loop;
 -- Column-major 6x5 board. Surviving symbols fall down within their columns.
 for step in 0..11 loop
  scatters=greatest(scatters,(select count(*) from jsonb_array_elements(board) where value='8'::jsonb));
  stage=hub_private.arcade_matches(board,stake); hits=stage->'positions'; boost=0;
  if (stage->>'coins')::integer>0 then
   if random()<0.18 then boost=(array[2,3,5,10,25])[1+floor(random()*5)::integer]; round_multiplier=least(100,round_multiplier+boost); end if;
   base_win=base_win+(stage->>'coins')::integer;
  end if;
  stages=stages||jsonb_build_array(stage||jsonb_build_object('board',board,'boost',boost));
  exit when jsonb_array_length(hits)=0;
  if step=11 then capped=true; exit; end if;
  next_board='[]';
  for c in 0..5 loop
   survivors='[]';
   for r in 0..4 loop i=c*5+r; if not hits @> to_jsonb(array[i]) then survivors=survivors||jsonb_build_array(board->i); end if; end loop;
   for i in 1..(5-jsonb_array_length(survivors)) loop next_board=next_board||to_jsonb(hub_private.arcade_symbol()); end loop;
   next_board=next_board||survivors;
  end loop;
  board=next_board;
 end loop;
 win=least(100000,base_win*greatest(1,round_multiplier));
 remaining=greatest(0,g.bonus_spins-case when bonus then 1 else 0 end);
 if scatters>=4 then added=case when bonus then 3 else 8 end; remaining=least(50,remaining+added); end if;
 update public.arcade_game_states set bonus_spins=remaining,bonus_stake=stake,
  multiplier=case when bonus and remaining>0 then round_multiplier else 0 end where user_id=u and game_id='kabayan-cascade';
 update public.arcade_wallets set balance=balance-cost+win,updated_at=clock_timestamp() where user_id=u returning * into w;
 result=jsonb_build_object('id',p_request_id,'stake',stake,'cost',cost,'win',win,'balance',w.balance,'stages',stages,
 'multiplier',greatest(1,round_multiplier),'baseWin',base_win,'bonusSpins',remaining,'bonusAdded',added,'wasBonus',bonus,
 'bonusMultiplier',case when bonus and remaining>0 then round_multiplier else 0 end,'capped',capped);
 insert into public.arcade_rounds(user_id,request_id,game_id,result) values(u,p_request_id,'kabayan-cascade',result);
 insert into public.arcade_transactions(user_id,game_id,kind,amount,balance,round_id) values(u,'kabayan-cascade','round',win-cost,w.balance,p_request_id);
 return result;
end $$;

revoke all on function hub_private.ensure_arcade_wallet(uuid),hub_private.arcade_symbol(),hub_private.arcade_matches(jsonb,integer) from public,anon,authenticated;
revoke all on function public.get_arcade_wallet(),public.refill_arcade_wallet(),public.play_kabayan_cascade(uuid,integer) from public,anon,authenticated;
grant execute on function public.get_arcade_wallet(),public.refill_arcade_wallet(),public.play_kabayan_cascade(uuid,integer) to authenticated;
