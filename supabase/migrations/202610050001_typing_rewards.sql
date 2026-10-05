-- Round seeds belong to the server. Only the replay-verifying API may credit KP.
create table public.typing_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  seed integer not null,
  difficulty text not null check(difficulty in ('easy','steady','fast')),
  created_at timestamptz not null default clock_timestamp(),
  status text not null default 'active' check(status in ('active','claimed','abandoned')),
  score integer,
  reward integer,
  claimed_at timestamptz
);
create index typing_rounds_user_status on public.typing_rounds(user_id,status);
alter table public.typing_rounds enable row level security;
revoke all on public.typing_rounds from public,anon,authenticated;
grant select,insert,update,delete on public.typing_rounds to service_role;

create function public.start_typing_round(p_difficulty text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid=auth.uid(); r public.typing_rounds;
begin
  if u is null then raise exception 'Sign in first' using errcode='42501'; end if;
  if p_difficulty is null or p_difficulty not in ('easy','steady','fast') then raise exception 'Invalid pace'; end if;
  perform 1 from public.users where id=u::text for update;
  if not found then raise exception 'Account missing'; end if;
  update public.typing_rounds set status='abandoned' where user_id=u and status='active';
  insert into public.typing_rounds(user_id,seed,difficulty) values(u,floor(random()*2147483647)::integer,p_difficulty) returning * into r;
  return jsonb_build_object('id',r.id,'seed',r.seed,'difficulty',r.difficulty);
end $$;
revoke all on function public.start_typing_round(text) from public,anon,authenticated;
grant execute on function public.start_typing_round(text) to authenticated;

create function public.credit_typing_round(p_round_id uuid,p_user_id uuid,p_score integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.typing_rounds; account jsonb; earned integer; stamp text=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if p_score is null or p_score<0 or p_score>120000 or p_score%10<>0 then raise exception 'Invalid verified score'; end if;
  select data into account from public.users where id=p_user_id::text for update;
  if account is null then raise exception 'Account missing'; end if;
  select * into r from public.typing_rounds where id=p_round_id and user_id=p_user_id for update;
  if not found then raise exception 'Round not found'; end if;
  if r.status='claimed' then return jsonb_build_object('awarded',false,'amount',r.reward,'points',account->'points'); end if;
  if r.status<>'active' or r.created_at<clock_timestamp()-interval '24 hours' then raise exception 'Round expired or replaced'; end if;
  earned=p_score/10;
  insert into public.activities(parent_id,id,data) values(p_user_id::text,'englishTypingRush_'||r.id,jsonb_build_object('type','englishTypingRush','score',p_score,'amount',earned,'points',earned,'createdAt',stamp));
  update public.users set data=data||jsonb_build_object('points',coalesce((data->>'points')::integer,0)+earned,'lastVisit',stamp) where id=p_user_id::text returning data into account;
  update public.typing_rounds set status='claimed',score=p_score,reward=earned,claimed_at=clock_timestamp() where id=r.id;
  return jsonb_build_object('awarded',true,'amount',earned,'points',account->'points');
end $$;
revoke all on function public.credit_typing_round(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.credit_typing_round(uuid,uuid,integer) to service_role;
