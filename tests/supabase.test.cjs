const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
let db;
const a='11111111-1111-4111-8111-111111111111', b='22222222-2222-4222-8222-222222222222';
const json=v=>JSON.stringify(v);
async function as(uid,fn){
 await db.exec('reset role');
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid||'']);
 await db.exec(uid?'set role authenticated':'set role anon');
 try{return await fn();}finally{await db.exec('reset role');}
}
const write=(table,id,data,mode='set',parent='')=>db.query('select public.hub_write($1,$2,$3,$4::jsonb,$5)',[table,parent,id,json(data),mode]);
const query=(table,constraints=[],parent='')=>db.query('select public.hub_query($1,$2,$3::jsonb) as rows',[table,parent,json(constraints)]).then(r=>r.rows[0].rows);
const profile=(name)=>db.query('select public.save_profile($1,$2,$3,$4)',[name,name,'Hello','']);
const coinWallet=()=>db.query('select public.get_arcade_wallet() as wallet').then(r=>r.rows[0].wallet);
const coinSpin=(id,stake=10)=>db.query('select public.play_kabayan_cascade($1,$2) as result',[id,stake]).then(r=>r.rows[0].result);
before(async()=>{
 db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 alter table auth.users add created_at timestamptz default now(),add last_sign_in_at timestamptz,add email_confirmed_at timestamptz;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
 await db.exec(fs.readFileSync('supabase/migrations/202609300001_hub.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/202609300004_account_preferences.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/202610040001_chat_reward_round.sql','utf8'));
 // Model hosted default grants, which are independent of the PUBLIC role.
 await db.exec('grant execute on all functions in schema public to anon');
 await db.exec(fs.readFileSync('supabase/migrations/202610040002_permission_hardening.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/202610050001_typing_rewards.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/202610070001_kabayan_coins.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/202610070002_play_coin_conversion.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/202610080001_admin_users.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/202610080002_kp_leaderboard.sql','utf8'));
 await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'a@example.test','{\"role\":\"admin\"}'),($2,'b@example.test','{}')",[a,b]);
 await db.query("insert into public.news(id,data) values('article',$1::jsonb)",[json({title:'News',reward:10,shareReward:5,createdAt:'2026-09-01T00:00:00.000Z'})]);
});
after(async()=>{await db?.close();});

test('arcade coins are private, immutable from clients, and do not change KP during play',async()=>{
 const before=(await db.query('select data from public.users where id=$1',[a])).rows[0].data.points;
 await as(null,async()=>{await assert.rejects(coinWallet());await assert.rejects(coinSpin(a));});
 await as(a,async()=>{
  const first=await coinWallet();assert.equal(first.balance,1000);assert.equal(first.history.length,1);assert.equal(first.history[0].kind,'starter');
  assert.equal((await coinWallet()).balance,1000);
  for(const table of ['arcade_wallets','arcade_rounds','arcade_game_states','arcade_transactions']) {
   assert.equal((await db.query("select has_table_privilege('authenticated',$1,'insert') as allowed",['public.'+table])).rows[0].allowed,false);
   assert.equal((await db.query("select has_table_privilege('authenticated',$1,'update') as allowed",['public.'+table])).rows[0].allowed,false);
  }
  await assert.rejects(db.query('update public.arcade_wallets set balance=999999 where user_id=$1',[a]));
  await assert.rejects(db.query("select public.claim_reward('arcade_coin','',1000)"));
 });
 await as(b,async()=>{assert.equal((await db.query('select * from public.arcade_wallets where user_id=$1',[a])).rows.length,0);assert.equal((await coinWallet()).balance,1000);});
 assert.equal((await db.query('select data from public.users where id=$1',[a])).rows[0].data.points,before);
 for(const fn of ['ensure_arcade_wallet(uuid)','arcade_symbol()','arcade_matches(jsonb,integer)']) assert.equal((await db.query("select has_function_privilege('authenticated',$1,'execute') as allowed",['hub_private.'+fn])).rows[0].allowed,false);
});

test('daily free coin refill credits once and resets by the server Saudi date',async()=>{
 await as(a,async()=>{
  await db.query('select refill_arcade_wallet()');await db.query('select refill_arcade_wallet()');
  const wallet=await coinWallet();assert.equal(wallet.balance,1500);assert.equal(wallet.canRefill,false);
  assert.equal(wallet.history.filter(x=>x.kind==='daily_refill').length,1);
 });
 await db.query("update public.arcade_wallets set last_refill=(clock_timestamp() at time zone 'Asia/Riyadh')::date-1 where user_id=$1",[a]);
 await as(a,async()=>{assert.equal((await coinWallet()).canRefill,true);await db.query('select refill_arcade_wallet()');assert.equal((await coinWallet()).balance,2000);});
});

test('cascade matches count anywhere, exclude scatters, and apply symbol tiers',async()=>{
 const board=[...Array(8).fill(0),...Array(10).fill(2),...Array(12).fill(8)];
 const m=(await db.query('select hub_private.arcade_matches($1::jsonb,100) as result',[json(board)])).rows[0].result;
 assert.equal(m.coins,70);assert.equal(m.positions.length,18);assert.deepEqual(m.wins,[{symbol:0,count:8,coins:10},{symbol:2,count:10,coins:60}]);
 assert.equal((await db.query('select hub_private.arcade_matches($1::jsonb,100) as result',[json(Array(30).fill(7))])).rows[0].result.coins,600);
});

test('server cascade rounds charge once, recover the same result, and record net coin history',async()=>{
 await as(a,async()=>{
  const before=(await coinWallet()).balance;
  const id='33333333-3333-4333-8333-333333333333';
  const [first,retry]=await Promise.all([coinSpin(id,25),coinSpin(id,100)]);
  assert.deepEqual(first,retry);assert.equal(first.cost,25);assert.equal(first.balance,before-25+first.win);
  assert.ok(first.stages.length>=1 && first.stages.length<=12);
  for(const stage of first.stages){assert.equal(stage.board.length,30);assert.ok(stage.board.every(x=>Number.isInteger(x)&&x>=0&&x<=8));assert.equal(stage.coins,stage.wins.reduce((n,w)=>n+w.coins,0));}
  assert.equal(first.win,Math.min(100000,first.baseWin*first.multiplier));
  assert.equal((await db.query('select * from public.arcade_transactions where round_id=$1',[id])).rows.length,1);
  assert.equal((await coinWallet()).lastRound.id,id);
  await assert.rejects(coinSpin('44444444-4444-4444-8444-444444444444',-10));
  await assert.rejects(coinSpin('44444444-4444-4444-8444-444444444444',15));
 });
 await as(b,async()=>{assert.equal((await db.query('select * from public.arcade_rounds where user_id=$1',[a])).rows.length,0);});
});

test('mascot scatters award bonus spins; bonus uses the saved stake and costs no coins',async()=>{
 const migration=fs.readFileSync('supabase/migrations/202610070001_kabayan_coins.sql','utf8');
 const original=migration.match(/create function hub_private\.arcade_symbol\(\)[\s\S]*?end \$\$;/)[0].replace('create function','create or replace function');
 await db.exec("create or replace function hub_private.arcade_symbol() returns integer language sql volatile set search_path='' as $$ select 8 $$;");
 try {
  const start=await as(b,()=>coinSpin('55555555-5555-4555-8555-555555555555',50));
  assert.equal(start.bonusAdded,8);assert.equal(start.bonusSpins,8);assert.equal(start.cost,50);assert.equal(start.win,0);
  await db.query("update public.arcade_rounds set created_at=clock_timestamp()-interval '2 seconds' where user_id=$1",[b]);
  await db.query('update public.arcade_wallets set balance=0 where user_id=$1',[b]);
  const free=await as(b,()=>coinSpin('66666666-6666-4666-8666-666666666666',100));
  assert.equal(free.wasBonus,true);assert.equal(free.stake,50);assert.equal(free.cost,0);assert.equal(free.balance,0);assert.equal(free.bonusSpins,10);assert.equal(free.bonusAdded,3);
  await db.exec("create or replace function hub_private.arcade_symbol() returns integer language sql volatile set search_path='' as $$ select 0 $$;");
  await db.query('update public.arcade_game_states set multiplier=5 where user_id=$1',[b]);
  await db.query("update public.arcade_rounds set created_at=clock_timestamp()-interval '2 seconds' where user_id=$1",[b]);
  const boosted=await as(b,()=>coinSpin('88888888-8888-4888-8888-888888888888',10));
  assert.equal(boosted.cost,0);assert.equal(boosted.stake,50);assert.equal(boosted.stages.length,12);assert.equal(boosted.capped,true);
  assert.equal(boosted.baseWin,180);assert.ok(boosted.multiplier>=5 && boosted.multiplier<=100);
  assert.equal(boosted.win,boosted.baseWin*boosted.multiplier);assert.equal(boosted.bonusMultiplier,boosted.multiplier);assert.equal(boosted.bonusSpins,9);
  await db.query('update public.arcade_game_states set bonus_spins=0 where user_id=$1',[b]);
  await db.query('update public.arcade_wallets set balance=0 where user_id=$1',[b]);
  await db.query("update public.arcade_rounds set created_at=clock_timestamp()-interval '2 seconds' where user_id=$1",[b]);
  await as(b,()=>assert.rejects(coinSpin('77777777-7777-4777-8777-777777777777',10),/Not enough/));
 } finally {await db.exec(original);}
});
test('privileged RPCs reject anonymous execution and leaderboard is read-only',async()=>{
 const signatures=['save_profile(text,text,text,text)','claim_reward(text,text,integer)','redeem_item(text)','draw_chat_reward()','hub_write(text,text,text,jsonb,text)'];
 for(const signature of signatures){
  assert.equal((await db.query("select has_function_privilege('anon',$1,'execute') as allowed",['public.'+signature])).rows[0].allowed,false);
 }
 await as(a,async()=>{
  await assert.rejects(write('leaderboard',a,{points:999},'merge'));
  const ranks=await query('leaderboard');
  assert.deepEqual(Object.keys(ranks[0].data).sort(),['displayName','points','username']);
 });
});
test('signup ignores malicious role metadata; role, balance, and other accounts protected',async()=>{
 await as(a,async()=>{
  assert.equal((await query('users'))[0].data.role,'user');
  assert.equal((await query('users')).length,1);
  await assert.rejects(write('users',a,{role:'admin'},'merge'));
  await assert.rejects(write('users',a,{points:99999},'merge'));
  await assert.rejects(write('users',a,{role:'user',points:1},'set'));
  await assert.rejects(write('users',b,{displayName:'Hacked'},'update'));
  await assert.rejects(write('news','illegal',{title:'No'}));
 });
 await as(null,async()=>{assert.equal((await query('users')).length,0);assert.equal((await query('news')).length,1);await assert.rejects(write('news','anon',{title:'No'}));});
});
test('unique handles, atomic profile edits, and private account data',async()=>{
 await as(a,()=>profile('maya'));
 await as(b,async()=>{await assert.rejects(profile('maya'));await profile('paolo');});
 await as(a,async()=>{
  await assert.rejects(db.query('select save_profile($1,$2,$3,$4)',['maya','Maya','','social/avatars/'+b+'/avatar.jpg']));
  await assert.rejects(write('social_profiles',a,{username:'forged'},'merge'));
  const ranks=await query('leaderboard'); assert.equal(ranks.length,2); assert.equal('email' in ranks[0].data,false); assert.equal('role' in ranks[0].data,false);
  await profile('maya_new');
 });
 await as(b,()=>profile('maya'));
});
test('social posts, follows, replies, and reports enforce ownership and earn no points',async()=>{
 await as(a,async()=>{
  await write('social_posts','post',{uid:a,text:'Kumusta',createdAt:'1900-01-01'});
  await assert.rejects(write('social_posts','spoof',{uid:b,text:'No'}));
  await assert.rejects(write('social_posts','long',{uid:a,text:'x'.repeat(501)}));
  await assert.rejects(write('social_posts','post',{text:'Edited'},'merge'));
  await write('follows',b,{createdAt:{__hub_op:'timestamp'}},'set',a);
  await assert.rejects(write('follows',a,{},'set',a));
 });
 await as(b,async()=>{
  await write('likes',b,{uid:b},'set','post');
  await assert.rejects(write('likes',a,{uid:a},'set','post'));
  await write('replies','reply',{uid:b,text:'Hello'},'set','post');
  await write('social_reports','post_'+b,{uid:b,postId:'post',reason:'spam',status:'open'});
  await assert.rejects(write('social_reports','post_'+b,{status:'reviewed'},'merge'));
  assert.equal((await query('follows',[],a)).length,0);
  assert.equal((await query('users'))[0].data.points,0);
 });
 await as(a,async()=>{assert.equal((await query('social_reports')).length,0);assert.equal((await query('likes',[],'post')).length,1);assert.equal((await query('replies',[],'post')).length,1);});
});
test('rewards use server amounts and prevent duplicates; social reward types rejected',async()=>{
 await as(a,async()=>{
  const claim=()=>db.query("select claim_reward('news_read','article',0) as result");
  assert.equal((await claim()).rows[0].result.amount,10);
  assert.equal((await claim()).rows[0].result.awarded,false);
  await assert.rejects(db.query("select claim_reward('social_post','post',999)"));
  await assert.rejects(write('activities','fake',{amount:10000},'set',a));
  assert.equal((await query('users'))[0].data.points,10);
 });
});
test('market redemption is atomic and prevents insufficient balance',async()=>{
 await db.query("insert into public.marketplace_items(id,data) values('item','{\"title\":\"Gift\",\"price\":8,\"stock\":1}')");
 await as(a,async()=>{
  assert.equal((await db.query("select redeem_item('item') as result")).rows[0].result.points,2);
  await assert.rejects(db.query("select redeem_item('item')"));
  assert.equal((await query('marketplace_purchases')).length,1);
  await assert.rejects(write('marketplace_purchases','fake',{userId:a,price:0}));
 });
 await as(b,async()=>{assert.equal((await query('marketplace_purchases')).length,0);});
});
test('server pagination handles equal timestamps, in filters, and numeric ordering',async()=>{
 for(let i=0;i<5;i++) await db.query("insert into social_posts(id,data) values($1,$2::jsonb)",['page'+i,json({uid:a,text:'Page '+i,createdAt:'2026-09-01T00:00:00.000Z'})]);
 // Insert trigger controls timestamps: set stable test fixtures with trusted SQL.
 await db.exec("update social_posts set data=jsonb_set(data,'{createdAt}','\"2026-09-01T00:00:00.000Z\"') where id like 'page%'");
 await as(null,async()=>{
  const constraints=[{kind:'where',field:'uid',op:'in',value:[a]},{kind:'where',field:'text',op:'>=',value:'Page'},{kind:'where',field:'text',op:'<',value:'Pagf'},{kind:'order',field:'createdAt',direction:'desc'},{kind:'order',field:'__name__',direction:'desc'},{kind:'limit',count:2}];
  const first=await query('social_posts',constraints);
  const next=await query('social_posts',[...constraints,{kind:'cursor',values:[first[1].data.createdAt,first[1].id]}]);
  assert.deepEqual(first.map(x=>x.id),['page4','page3']); assert.deepEqual(next.map(x=>x.id),['page2','page1']);
  await assert.rejects(query('auth.users')); await assert.rejects(query('social_posts',[{kind:'where',field:"x'); drop table users;--",op:'==',value:1}]));
 });
});
test('private budgets and job applications are isolated; deleting posts cascades',async()=>{
 await as(a,async()=>{await write('budget_entries','entry',{amount:50},'set',a);await write('job_applications','application',{uid:a,jobId:'job',status:'pending'});});
 await as(b,async()=>{assert.equal((await query('budget_entries',[],a)).length,0);assert.equal((await query('job_applications')).length,0);await assert.rejects(write('budget_entries','entry',{amount:0},'update',a));});
 await as(a,()=>write('social_posts','post',{},'delete'));
 assert.equal((await db.query("select count(*)::int n from likes where parent_id='post'")).rows[0].n,0);
 assert.equal((await db.query("select count(*)::int n from replies where parent_id='post'")).rows[0].n,0);
});
test('tracker preferences remain editable while identity and reward fields stay protected',async()=>{
 await as(a,async()=>{
  await write('users',a,{budgetTargetMonthly:500,budgetCurrency:'SAR',calorieGoalDaily:2000,proteinGoalDaily:100},'merge');
  assert.equal((await query('users'))[0].data.budgetCurrency,'SAR');
  await assert.rejects(write('users',a,{username:'stolen'},'merge'));
  await assert.rejects(write('users',a,{budgetCurrency:'invalid'},'merge'));
  await assert.rejects(db.query('select save_profile(null,null,null,null)'));
  await assert.rejects(db.query("select claim_reward('arabicWordRush',null,null)"));
 });
});
test('administrators can moderate and edit news, with one chat reward per server round',async()=>{
 await db.query("update users set data=data||'{\"role\":\"admin\"}' where id=$1",[b]);
 await as(b,async()=>{
  await write('news','article',{title:'Updated news'},'merge');
  await write('social_reports','post_'+b,{status:'reviewed'},'merge');
  await write('tambayan_config','display',{earningPointsEnabled:true});
 });
 await as(a,()=>write('tambayan_chat','eligible',{uid:a,username:'Maya',type:'text',text:'Hello'}));
 await db.exec("update tambayan_chat set data=jsonb_set(data,'{createdAt}',to_jsonb(to_timestamp(floor(extract(epoch from now())/600)*600)-interval '15 minutes')) where id='eligible'");
 await as(a,async()=>{
  assert.equal((await db.query('select draw_chat_reward() as result')).rows[0].result.amount,50);
  assert.equal((await db.query('select draw_chat_reward() as result')).rows[0].result,null);
  await assert.rejects(write('news','article',{title:'Not admin'},'merge'));
 });
});

test('typing rounds credit 10:1 only through trusted service and only once',async()=>{
 const start=()=>db.query("select start_typing_round('steady') as result").then(r=>r.rows[0].result);
 await as(null,async()=>{await assert.rejects(start());});
 const round=await as(a,start);
 const before=(await db.query("select (data->>'points')::integer as points from users where id=$1",[a])).rows[0].points;
 await as(a,async()=>{
  await assert.rejects(db.query('select credit_typing_round($1,$2,100)',[round.id,a]));
  await assert.rejects(db.query('select * from typing_rounds'));
 });
 await db.exec('set role service_role');
 try {
  await assert.rejects(db.query('select credit_typing_round($1,$2,100)',[round.id,b]));
  const first=(await db.query('select credit_typing_round($1,$2,100) as result',[round.id,a])).rows[0].result;
  assert.equal(first.amount,10); assert.equal(first.points,before+10);
  const second=(await db.query('select credit_typing_round($1,$2,800) as result',[round.id,a])).rows[0].result;
  assert.equal(second.awarded,false); assert.equal(second.amount,10); assert.equal(second.points,before+10);
 } finally { await db.exec('reset role'); }
 const abandoned=await as(a,start);await as(a,start);
 await assert.rejects(db.query('select credit_typing_round($1,$2,100)',[abandoned.id,a]));
 assert.equal((await db.query("select count(*)::integer as n from activities where id=$1",['englishTypingRush_'+round.id])).rows[0].n,1);
 assert.equal((await db.query("select has_function_privilege('anon','credit_typing_round(uuid,uuid,integer)','execute') as allowed")).rows[0].allowed,false);
});

test('coin conversion is atomic, 10:1, private, and idempotent; marketplace collects virtual items',async()=>{
 const c='99999999-9999-4999-8999-999999999999';
 await db.query("insert into auth.users(id,email) values($1,'conversion@example.test')",[c]);
 const convert=(id,coins)=>db.query('select convert_arcade_coins($1,$2) as result',[id,coins]).then(r=>r.rows[0].result);
 await as(null,()=>assert.rejects(convert(a,100)));
 await as(c,async()=>{
  assert.equal((await coinWallet()).balance,1000);
  const [first,retry]=await Promise.all([convert(a,100),convert(a,500)]);
  assert.deepEqual(first,retry); assert.equal(first.earned,10); assert.equal(first.points,10); assert.equal(first.balance,900);
  assert.equal((await db.query("select count(*)::integer as n from arcade_transactions where kind='conversion'")).rows[0].n,1);
  assert.equal((await query('activities',[],c)).filter(x=>x.data.type==='coin_conversion').length,1);
  for(const amount of [null,-10,0,11,1.5,1000010,910]) await assert.rejects(convert(b,amount));
  await assert.rejects(convert(null,10));
  assert.equal((await coinWallet()).balance,900);
  await assert.rejects(db.query("update arcade_conversions set result='{}' where user_id=$1",[c]));
 });
 await as(b,async()=>{assert.equal((await db.query('select * from arcade_conversions where user_id=$1',[c])).rows.length,0);});
 await db.query("update users set data=data||'{\"points\":2147483647}'::jsonb where id=$1",[c]);
 await as(c,async()=>{await assert.rejects(convert(b,10),/limit/);assert.equal((await coinWallet()).balance,900);});
 await db.query("update users set data=data||'{\"points\":10}'::jsonb where id=$1",[c]);
 await as(c,async()=>{
  const outcomes=await Promise.allSettled([convert(b,900),convert(c,900)]);
  assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
  assert.equal((await coinWallet()).balance,0);
  assert.equal((await query('users'))[0].data.points,100);
  assert.equal((await db.query('select count(*)::integer as n from arcade_conversions')).rows[0].n,2);
 });
 await db.query("insert into marketplace_items(id,data) values('virtual-test','{\"title\":\"Virtual badge\",\"price\":10,\"stock\":1}')");
 await as(c,async()=>{
  const collected=(await db.query("select redeem_item('virtual-test') as result")).rows[0].result;
  assert.equal(collected.points,90);assert.equal(collected.stock,0);
  const item=(await query('marketplace_purchases'))[0].data;
  assert.equal(item.virtualOnly,true);assert.equal(item.status,'redeemed');assert.ok(item.redeemedAt);
 });
});

test('admin users enforce roles, stale balance checks, audit logs, blocking, and deletion cleanup',async()=>{
 const manager='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', member='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 await db.query("select set_config('request.jwt.claim.sub','',false)");
 await db.query("insert into auth.users(id,email) values($1,'admin-fixture@example.test'),($2,'member-fixture@example.test')",[manager,member]);
 await db.query("update users set data=data||'{\"role\":\"admin\"}'::jsonb where id=$1",[manager]);
 const action=(id,kind,values,target=member)=>db.query('select admin_user_action($1,$2,$3,$4::jsonb) as result',[id,target,kind,json({reason:'Verification',...values})]).then(r=>r.rows[0].result);
 const list=()=>db.query("select admin_list_users('member-fixture',0,'all') as result").then(r=>r.rows[0].result);
 await as(null,()=>assert.rejects(list()));
 await as(member,async()=>{await assert.rejects(list());await assert.rejects(action(a,'balances',{points:10,coins:500,expectedPoints:0,expectedCoins:1000}));});
 await as(manager,async()=>{
  const found=await list();assert.equal(found.total,1);assert.equal(found.users[0].email,'member-fixture@example.test');assert.equal(found.users[0].coins,1000);
  const values={points:50,coins:800,expectedPoints:0,expectedCoins:1000};
  const [first,retry]=await Promise.all([action(a,'balances',values),action(a,'balances',values)]);
  assert.deepEqual(first,retry);assert.equal(first.points,50);assert.equal(first.coins,800);
  await assert.rejects(action(b,'balances',values),/Balances changed/);
  await assert.rejects(action(b,'balances',{points:-1,coins:800,expectedPoints:50,expectedCoins:800}));
  await assert.rejects(action(b,'block',{},manager),/Administrator/);
  await assert.rejects(action(b,'delete',{},manager),/Administrator/);
  const audit=await db.query('select * from admin_user_audit where request_id=$1',[a]);assert.equal(audit.rows.length,1);assert.equal(audit.rows[0].before_state.coins,1000);
 });
 await as(member,async()=>{
  assert.equal((await coinWallet()).balance,800);
  assert.equal((await query('users'))[0].data.points,50);
  await profile('admin_delete_fixture');
  await write('social_posts','admin-delete-post',{uid:member,text:'Disposable post'});
  await write('job_applications','admin-delete-job',{uid:member,jobId:'job',status:'pending'});
 });
 await as(manager,()=>action(b,'block',{}));
 await as(member,async()=>{
  assert.equal((await query('users')).length,0);
  assert.equal((await db.query('select * from admin_user_audit')).rows.length,0);
  await assert.rejects(coinWallet(),/blocked/);
  await assert.rejects(db.query("select claim_reward('daily_checkin')"),/blocked/);
  await assert.rejects(profile('blocked_member'),/blocked/);
  await assert.rejects(write('users',member,{blocked:false},'merge'));
  await assert.rejects(write('tambayan_chat','blocked-message',{uid:member,text:'Not allowed'}));
 });
 await db.query("select set_config('request.jwt.claim.sub','',false)");
 await assert.rejects(db.query('select credit_typing_round($1,$2,10)',[a,member]),/blocked/);
 await as(manager,()=>action('cccccccc-cccc-4ccc-8ccc-cccccccccccc','unblock',{}));
 await as(member,()=>assert.doesNotReject(coinWallet()));
 await as(manager,()=>action('dddddddd-dddd-4ddd-8ddd-dddddddddddd','delete',{}));
 await db.query("select set_config('request.jwt.claim.sub','',false)");
 await db.query('delete from auth.users where id=$1',[member]);
 assert.equal((await db.query('select * from public.users where id=$1',[member])).rows.length,0);
 assert.equal((await db.query('select * from arcade_wallets where user_id=$1',[member])).rows.length,0);
 assert.equal((await db.query("select * from social_posts where id='admin-delete-post'")).rows.length,0);
 assert.equal((await db.query("select * from job_applications where data->>'uid'=$1",[member])).rows.length,0);
 assert.equal((await db.query('select * from admin_user_audit where target_id=$1',[member])).rows.length,4);
});

test('KP leaderboard sorts current balances, shares ranks for ties, excludes blocked accounts, and keeps emails private',async()=>{
 const ids=['10101010-1010-4010-8010-101010101010','20202020-2020-4020-8020-202020202020','30303030-3030-4030-8030-303030303030'];
 await db.query("select set_config('request.jwt.claim.sub','',false)");
 for(let i=0;i<3;i++) {
  await db.query('insert into auth.users(id,email) values($1,$2)',[ids[i],`rank-${i}@example.test`]);
  await db.query("update users set data=data||jsonb_build_object('points',$2::integer,'username',$3::text) where id=$1",[ids[i],i<2?123456:123455,`rank_${i}`]);
 }
 const ranks=()=>db.query('select get_kp_leaderboard() as result').then(r=>r.rows[0].result);
 await as(null,()=>assert.rejects(ranks()));
 await as(ids[2],async()=>{
  const result=await ranks();
  assert.deepEqual(result.members.slice(0,3).map(x=>x.rank),[1,1,3]);
  assert.equal(result.me.rank,3);assert.equal(result.me.points,123455);
  assert.deepEqual(Object.keys(result.members[0]).sort(),['displayName','id','points','rank','username']);
 });
 await db.query("select set_config('request.jwt.claim.sub','',false)");
 await db.query("update users set data=data||'{\"points\":1,\"blocked\":true}'::jsonb where id=$1",[ids[0]]);
 await db.query("update users set data=data||'{\"points\":999999}'::jsonb where id=$1",[ids[2]]);
 await as(ids[0],()=>assert.rejects(ranks()));
 await as(ids[2],async()=>{
  const result=await ranks();assert.equal(result.members[0].id,ids[2]);assert.equal(result.me.rank,1);
  assert.ok(!result.members.some(x=>x.id===ids[0]));
 });
});
