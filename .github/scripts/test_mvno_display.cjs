const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={};vm.runInNewContext(fs.readFileSync('assets/mvno-display.js','utf8'),{window});
const api=window.WoongbiMvnoDisplay;
const data=JSON.parse(fs.readFileSync('data/mvno-postpaid.json','utf8'));
assert.equal(api.clean(data).plans.length,data.plans.length,'Excluded providers must not return in published data');
assert.equal(api.clean(data).providers.length,data.providers.length);
const injected={providers:[...data.providers,{id:'SMKT',name:'스노우맨'}],plans:[...data.plans,{id:'excluded',provider_id:'SMKT',monthly_fee:1,data:'7GB',voice:'무제한'}]};
assert(!api.clean(injected).plans.some(p=>p.id==='excluded'));
const rows=api.recommend(data);assert.equal(rows.length,3);assert.equal(new Set(rows.map(r=>r.group.key)).size,3);
for(const group of api.groups){
 const choices=api.recommend(data,group.key);assert(choices.length>0&&choices.length<=3);
 const fee=p=>Number(p.special_monthly_fee??p.monthly_fee);
 choices.forEach((row,index)=>{assert(group.match(row.plan));assert(data.plans.some(p=>p.id===row.plan.id));if(index)assert(fee(choices[index-1].plan)<=fee(row.plan));});
}
console.log('MVNO assortment exclusion, usage groups and price ordering passed.');
