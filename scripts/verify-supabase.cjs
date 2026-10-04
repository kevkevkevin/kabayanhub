// Explicit hosted smoke test. Creates disposable accounts in the named project.
// CLI authentication is required; server credentials stay in process memory.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const assert=require('node:assert/strict');
const {createClient}=require('@supabase/supabase-js');
const project='yhvtgxrqxqbqqeokfwpg';
const folder=path.join(process.env.TEMP||'/tmp','kabayan-supabase-migration');
const sessionFile=path.join(folder,'smoke-session.json');
async function main(){
 const keys=JSON.parse(cp.execSync(`npx --yes supabase projects api-keys --project-ref ${project} --output json --agent no`,{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 const serverKey=keys.find(k=>k.name==='service_role')?.api_key;
 const publicKey=keys.find(k=>k.type==='publishable')?.api_key;
 if(!serverKey||!publicKey)throw Error('Required API keys unavailable');
 const url=`https://${project}.supabase.co`;
 const options={auth:{persistSession:false,autoRefreshToken:false},realtime:{transport:require('ws')}};
 const admin=createClient(url,serverKey,options);
 const check=({data,error})=>{if(error)throw Error(error.message);return data;};
 if(process.argv.includes('--cleanup')){
  const session=JSON.parse(fs.readFileSync(sessionFile,'utf8'));
  for(const id of session.ids)check(await admin.auth.admin.deleteUser(id));
  check(await admin.from('social_reports').delete().in('data->>uid',session.ids));
  check(await admin.from('job_applications').delete().in('data->>uid',session.ids));
  await admin.storage.from('avatars').remove(session.ids.map(id=>`social/avatars/${id}/avatar.jpg`));
  fs.unlinkSync(sessionFile); console.log('Disposable verification accounts and records removed.'); return;
 }
 if(fs.existsSync(sessionFile))throw Error('A smoke session already exists; clean it up before starting another.');
 const password=crypto.randomBytes(24).toString('base64url');
 const suffix=Date.now(); const ids=[];const clients=[];
 fs.mkdirSync(folder,{recursive:true});
 const save=()=>fs.writeFileSync(sessionFile,JSON.stringify({ids,email:`smoke-${suffix}-0@example.test`,password,project}));
 for(let i=0;i<2;i++){
  const email=`smoke-${suffix}-${i}@example.test`;
  const created=check(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{username:`smoke${i}`,displayName:`Migration check ${i}`}}));
  ids.push(created.user.id);save();
  const client=createClient(url,publicKey,options);check(await client.auth.signInWithPassword({email,password}));clients.push(client);
 }
 const [a,b]=clients;const [uid,other]=ids;
 const write=(client,table,id,data,mode='set',parent='')=>client.rpc('hub_write',{p_table:table,p_parent:parent,p_id:id,p_data:data,p_mode:mode});
 check(await a.rpc('save_profile',{p_username:`test_${suffix}`,p_display_name:'Migration check',p_bio:'Temporary verification profile',p_photo_path:''}));
 assert.ok((await b.rpc('save_profile',{p_username:`test_${suffix}`,p_display_name:'Duplicate',p_bio:'',p_photo_path:''})).error);
 check(await b.rpc('save_profile',{p_username:`other_${suffix}`,p_display_name:'Other check',p_bio:'',p_photo_path:''}));
 assert.ok((await write(a,'users',uid,{role:'admin'},'merge')).error);
 assert.ok((await write(a,'users',uid,{points:999},'merge')).error);
 assert.equal(check(await b.from('users').select('id').eq('id',uid)).length,0);
 const post='smoke-'+suffix;
 check(await write(a,'social_posts',post,{uid,text:'Migration verification post',createdAt:{__hub_op:'timestamp'}}));
 assert.ok((await write(b,'social_posts','spoof-'+suffix,{uid,text:'Invalid'})).error);
 check(await write(b,'likes',other,{uid:other},'set',post));
 check(await write(b,'replies','reply-'+suffix,{uid:other,text:'Verification reply'},'set',post));
 check(await write(a,'follows',other,{},'set',uid));
 check(await write(b,'social_reports',post+'_'+other,{uid:other,postId:post,reason:'other',status:'open'}));
 check(await write(a,'users',uid,{budgetTargetMonthly:100,budgetCurrency:'SAR',calorieGoalDaily:2000,proteinGoalDaily:100},'merge'));
 check(await write(a,'budget_entries','entry',{amount:12,date:'2026-09-30'},'set',uid));
 assert.equal(check(await b.from('budget_entries').select('id').eq('parent_id',uid)).length,0);
 const image=fs.readFileSync('public/baybayin-hero.png');
 // Upload the supported JPEG format with a real JPEG fixture supplied below.
 const jpeg=Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=','base64');
 const avatar=`social/avatars/${uid}/avatar.jpg`;
 check(await a.storage.from('avatars').upload(avatar,jpeg,{contentType:'image/jpeg',upsert:true}));
 assert.ok((await b.storage.from('avatars').upload(avatar,jpeg,{contentType:'image/jpeg',upsert:true})).error);
 assert.ok((await a.storage.from('avatars').upload(`social/avatars/${uid}/wrong.png`,image,{contentType:'image/png'})).error);
 check(await a.rpc('save_profile',{p_username:`test_${suffix}`,p_display_name:'Migration check',p_bio:'Temporary verification profile',p_photo_path:avatar}));
 const publicUrl=a.storage.from('avatars').getPublicUrl(avatar).data.publicUrl;
 assert.equal((await fetch(publicUrl)).status,200);
 const news=check(await a.from('news').select('id,data'));
 assert.equal(news.length,13);
 const sourceFile=fs.readdirSync(folder).find(f=>f.startsWith('news-firestore-')&&f.endsWith('.json'));
 const expected=require('./convert-news-export.cjs').convert(JSON.parse(fs.readFileSync(path.join(folder,sourceFile),'utf8')));
 for(const row of expected) assert.deepEqual(news.find(n=>n.id===row.id)?.data,row.data);
 const claim=()=>a.rpc('claim_reward',{p_type:'news_read',p_ref:news[0].id,p_score:0});
 assert.equal(check(await claim()).awarded,true);assert.equal(check(await claim()).awarded,false);
 const queried=check(await a.rpc('hub_query',{p_table:'social_posts',p_parent:'',p_constraints:[{kind:'where',field:'uid',op:'in',value:[uid]},{kind:'order',field:'createdAt',direction:'desc'},{kind:'limit',count:20}]}));
 assert.equal(queried.length,1);
 console.log('PASS: hosted auth, profiles, unique handles, role protection, private data, posts, likes, replies, follows, reports, tracker preferences, avatar ownership, public images, duplicate rewards, and exact preservation of all 13 news articles.');
 console.log('Disposable browser verification credentials saved locally at '+sessionFile);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
