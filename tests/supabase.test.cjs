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
before(async()=>{
 db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
 await db.exec(fs.readFileSync('supabase/migrations/202609300001_hub.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/202609300004_account_preferences.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/202610040001_chat_reward_round.sql','utf8'));
 // Model hosted default grants, which are independent of the PUBLIC role.
 await db.exec('grant execute on all functions in schema public to anon');
 await db.exec(fs.readFileSync('supabase/migrations/202610040002_permission_hardening.sql','utf8'));
 await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'a@example.test','{\"role\":\"admin\"}'),($2,'b@example.test','{}')",[a,b]);
 await db.query("insert into public.news(id,data) values('article',$1::jsonb)",[json({title:'News',reward:10,shareReward:5,createdAt:'2026-09-01T00:00:00.000Z'})]);
});
after(async()=>{await db?.close();});
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
