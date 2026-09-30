const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={};vm.runInNewContext(fs.readFileSync('assets/mvno-display.js','utf8'),{window});
const api=window.WoongbiMvnoDisplay;
const data=JSON.parse(fs.readFileSync('data/mvno-postpaid.json','utf8'));
assert.equal(api.clean(data).plans.length,data.plans.length,'Excluded providers must not return in published data');
assert.equal(api.clean(data).providers.length,data.providers.length);
const injected={providers:[...data.providers,{id:'SMKT',name:'스노우맨'}],plans:[...data.plans,{id:'excluded',provider_id:'SMKT',monthly_fee:1,data:'7GB',voice:'무제한'}]};
assert(!api.clean(injected).plans.some(p=>p.id==='excluded'));
const rows=api.recommend(data);assert.equal(rows.length,3);assert.equal(new Set(rows.map(r=>r.group.key)).size,3);
assert.deepEqual(Array.from(rows,r=>r.plan.id),['MMOBILE-1295','SKYLIFE-2069','UPLUSE-2390']);
const cheap={...data,plans:[...data.plans,{id:'unreviewed-cheapest',provider_id:'MMOBILE',monthly_fee:1,data:'4GB',voice:'무제한'}]};
assert(!api.recommend(cheap,'light').some(r=>r.plan.id==='unreviewed-cheapest'),'Unreviewed cheap plans must not replace store assortment');
assert(api.recommend(data,'data').some(r=>r.plan.id==='SKYLIFE-2084'),'Daily data plan belongs to high-use comparison');
for(const key of ['light','daily','data'])for(const {plan} of api.recommend(data,key))assert(plan.customer_note,'Every store pick needs customer terms');
const contracted=data.plans.find(p=>p.id==='UPLUSE-2390');assert.equal(contracted.contract_months,12);assert.match(contracted.customer_note,/할인반환금/);
assert.match(data.plans.find(p=>p.id==='MMOBILE-2148').customer_note,/880원.*19,280원/);
assert.equal(data.plans.find(p=>p.id==='SKYLIFE-1615').monthly_fee,13900);
assert.match(data.plans.find(p=>p.id==='MMOBILE-2151').data,/3Mbps/);
assert(!/수수료|환수|마진|commission|rebate|mnp_fee/i.test(JSON.stringify(data)),'Public data must contain customer terms only');
for(const group of api.groups){
 const choices=api.recommend(data,group.key);assert(choices.length>0&&choices.length<=3);
 const fee=p=>Number(p.special_monthly_fee??p.monthly_fee);
 choices.forEach((row,index)=>{assert(group.match(row.plan));assert(data.plans.some(p=>p.id===row.plan.id));if(index)assert(fee(choices[index-1].plan)<=fee(row.plan));});
}
console.log('MVNO assortment exclusion, usage groups and price ordering passed.');
