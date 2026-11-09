'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const bridge=fs.readFileSync('assets/home-recommend-api.min.js','utf8');
const catalog=JSON.parse(fs.readFileSync('data/catalog.json','utf8'));
const plans=JSON.parse(fs.readFileSync('data/plans.json','utf8'));
const supports=JSON.parse(fs.readFileSync('data/supports.json','utf8'));
const pins=[
  ['SKT-XD-3065','SKT-XP-969'],
  ['LG-XD-2890','LG-XP-2512'],
  ['SKT-XD-2944','SKT-XP-969']
];
for(const [deviceId,planId] of pins){
  const device=catalog.devices.find(d=>d.id===deviceId);
  assert.ok(device,'missing storefront device in active catalog: '+deviceId);
  const plan=plans.mobile_plans.find(p=>p.id===planId);
  assert.ok(plan,'missing featured plan in active catalog: '+planId);
  assert.equal(device.carrier,plan.carrier,'carrier mismatch: '+deviceId);
  assert.ok(device.eligible_plan_ids?.includes(planId),'not an eligible device-plan pair: '+deviceId);
}
assert.ok(supports.support_schedules.some(s=>s.carrier==='SKT'&&s.device_ids?.includes('SKT-XD-3065')&&Number.isFinite(s.amounts?.['SKT-XP-969'])),'A18 support schedule missing');

const calls=[];
async function mockFetch(url,opts){
  const payload=JSON.parse(opts.body);
  calls.push({url,payload});
  if(url.endsWith('/recommend/purpose'))return {ok:true,json:async()=>({ok:true,items:[]})};
  assert.ok(url.endsWith('/quote/mobile'),'unexpected URL '+url);
  assert.ok(pins.some(([deviceId,planId])=>deviceId===payload.device_id&&planId===payload.plan_id),'invalid API pin '+payload.device_id);
  assert.equal(payload.join_type,'번호이동');
  assert.equal(payload.months,24);
  return {ok:true,json:async()=>({ok:true,quote:{known:true,monthly:42123,planFee:33000}})};
}
const ctx={window:{},document:{documentElement:{dataset:{}}},fetch:mockFetch,AbortController,setTimeout,clearTimeout,URLSearchParams,console};
vm.createContext(ctx);
vm.runInContext(bridge,ctx,{filename:'home-recommend-api.min.js'});
ctx.window.WoongbiRecommendationV2.ready.then(()=>{
  const engine=ctx.window.WoongbiRecommendationV2;
  assert.equal(engine.status().ready,true);
  assert.equal(engine.recommend('senior')[0].d.id,'SKT-XD-3065');
  assert.equal(engine.recommend('senior')[0].best.monthly,42123);
  assert.equal(engine.recommend('senior')[0].quoteUnavailable,false);
  assert.equal(engine.recommend('value')[0].d.id,'SKT-XD-2944');
  assert.ok(calls.some(c=>c.payload.device_id==='SKT-XD-3065'&&c.payload.method==='support'));
  assert.ok(calls.some(c=>c.payload.device_id==='SKT-XD-3065'&&c.payload.method==='contract'));
  console.log('Featured device catalog checks and mocked monthly quote requests passed.');
}).catch(error=>{console.error(error);process.exitCode=1});
