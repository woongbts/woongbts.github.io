import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const bundle=async path=>(await build({entryPoints:[fileURLToPath(new URL(path,import.meta.url))],bundle:true,write:false,format:'esm',external:['cloudflare:*']})).outputFiles[0].text;
const original=await bundle('../src/worker.js');
const gateway=await bundle('../src/consent-public.js');
const schema=await readFile(new URL('../migrations/0001_init.sql',import.meta.url),'utf8');
const headers={'X-CRM-Dev-Email':'admin@example.invalid','content-type':'application/json',origin:'https://crm.test'};
const bindings={DEV_AUTH_BYPASS:'1',ALLOWED_ADMIN_EMAILS:'admin@example.invalid',SMS_MODE:'dry_run',
  CRM_DATA_KEY_B64:Buffer.alloc(32,7).toString('base64'),CRM_HMAC_KEY_B64:Buffer.alloc(32,9).toString('base64')};

// A fixture-only approved policy exercises the dormant live flow. Never deploy it.
for(const enabled of [false,true]){
 const script=enabled?original.replace('approved: false','approved: true').replace(/pending: \[[^\]]*\]/,'pending: []'):original;
 if(enabled){assert.ok(script.includes('approved: true'));assert.ok(script.includes('pending: []'));}
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[
   {name:'crm',routes:['crm.test/*'],modules:true,script,compatibilityDate:'2026-09-01',bindings,d1Databases:['DB']},
   {name:'public',routes:['consent.test/*'],modules:true,script:gateway,compatibilityDate:'2026-09-01',serviceBindings:{CONSENT:{name:'crm',entrypoint:'ConsentPublic'},ASSETS:()=>new Response('consent fixture')}}
 ]}));
 try{
  const db=await mf.getD1Database('DB','crm');
  for(const sql of schema.split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
  const crm={fetch:(...args)=>mf.dispatchFetch(...args)},pub=crm;
  const admin=async(path,body)=>crm.fetch('https://crm.test/api/'+path,{headers,method:body?'POST':'GET',...(body?{body:JSON.stringify(body)}:{})});
  const call=async(path,body,origin='https://consent.test')=>pub.fetch('https://consent.test/api/'+path,{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)});
  let r=await admin('import',{rows:[{name:'가상고객',phone:['010','0000','0001'].join(''),carrier:'KT',opened_on:'2024-09-01'}]});
  assert.equal(r.status,200,await r.text());
  const id=(await (await admin('customers')).json()).customers[0].id;
  const path='customers/'+id;
  assert.equal((await crm.fetch('https://crm.test/api/consent-policy')).status,401);
  assert.equal((await admin(path+'/consent',{status:'granted',method:'web',evidence:'test'})).status,409);
  assert.equal((await call('form',{token:'f'.repeat(64)},'https://attacker.invalid')).status,403);
  assert.equal((await pub.fetch('https://consent.test/api/customers')).status,404);
  assert.equal((await pub.fetch('https://consent.test/')).headers.get('cache-control'),'no-store');
  assert.equal((await (await admin(path+'/consent-history')).json()).events.length,0);
  r=await admin(path+'/consent-session',{adult_confirmed:true});
  if(!enabled){assert.equal(r.status,409);assert.equal((await db.prepare('SELECT COUNT(*) n FROM consent_events').first()).n,0);continue;}
  assert.equal(r.status,200,await r.clone().text());
  const first=await r.json();
  assert.ok(!first.url.includes(id));assert.ok(!first.url.includes('가상'));
  const token=first.url.split('#')[1];
  const raw=await db.prepare('SELECT * FROM consent_sessions').first();
  assert.notEqual(raw.token_hash,token);assert.ok(!raw.issued_by_enc.includes('admin'));
  const second=await (await admin(path+'/consent-session',{adult_confirmed:true})).json();
  assert.equal((await call('form',{token})).status,410);
  const t=second.url.split('#')[1];
  r=await call('form',{token:t});assert.equal(r.status,200,await r.clone().text());
  const form=await r.json();
  assert.equal(form.customer_label,'가** 고객님 · 연락처 끝번호 0001');
  assert.equal(JSON.stringify(form).includes(id),false);
  const choices={marketing_use:true,ad_sms:true,ad_kakao:false,ad_call:true};
  assert.equal((await call('submit',{token:t,form_hash:'wrong',choices})).status,409);
  assert.equal((await call('submit',{token:t,form_hash:form.form_hash,choices:{...choices,marketing_use:false}})).status,400);
  const responses=await Promise.all([1,2].map(()=>call('submit',{token:t,form_hash:form.form_hash,choices,captured_at:'2000-01-01'})));
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,410]);
  let events=(await (await admin(path+'/consent-history')).json()).events;
  assert.equal(events.length,1);assert.equal(events[0].choices.ad_kakao,'denied');
  assert.ok(events[0].captured_at.startsWith(new Date().getUTCFullYear().toString()));
  assert.equal(new Date(events[0].valid_until).getUTCFullYear(),new Date(events[0].captured_at).getUTCFullYear()+3);
  assert.equal(new Date(events[0].first_confirmation_due).getUTCFullYear(),new Date(events[0].captured_at).getUTCFullYear()+2);
  assert.equal(events[0].form.version,form.policy.version);
  assert.equal((await (await admin('campaigns/preview',{})).json()).eligible,1);
  await db.prepare("UPDATE consent_events SET valid_until='2000-01-01' WHERE id=?").bind(events[0].id).run();
  assert.equal((await (await admin('campaigns/preview',{})).json()).eligible,0);
  await db.prepare('UPDATE consent_events SET valid_until=? WHERE id=?').bind(events[0].valid_until,events[0].id).run();
  assert.equal((await call('form',{token:t})).status,410);
  const active=await (await admin(path+'/consent-session',{adult_confirmed:true})).json();
  assert.equal((await admin(path+'/consent-withdraw',{confirmed:true})).status,200);
  assert.equal((await call('form',{token:active.url.split('#')[1]})).status,410);
  events=(await (await admin(path+'/consent-history')).json()).events;
  assert.equal(events.length,2);assert.equal(events[0].choices.marketing_use,'withdrawn');assert.equal(events[1].choices.marketing_use,'consented');
  const declined=await (await admin(path+'/consent-session',{adult_confirmed:true})).json();
  const dt=declined.url.split('#')[1],df=await (await call('form',{token:dt})).json();
  assert.equal((await call('submit',{token:dt,form_hash:df.form_hash,choices:Object.fromEntries(Object.keys(choices).map(p=>[p,false]))})).status,200);
  const expire=await (await admin(path+'/consent-session',{adult_confirmed:true})).json();
  await db.prepare("UPDATE consent_sessions SET expires_at='2000-01-01' WHERE used_event IS NULL").run();
  assert.equal((await call('form',{token:expire.url.split('#')[1]})).status,410);
  assert.equal((await (await admin('campaigns/preview',{})).json()).eligible,0);
  assert.equal((await (await admin('health')).json()).sms_mode,'dry_run');
  console.log('Consent token isolation, replay race, evidence, server time, refusal, expiry and withdrawal passed');
 }finally{await mf.dispose();}
}
console.log('Draft policy blocks production collection; unknown customers stay unknown');
