const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('assets/mvno-display.js','utf8');
const bridge=fs.readFileSync('assets/mvno-api-bridge.min.js','utf8');
const window={};vm.runInNewContext(source,{window});
const api=window.WoongbiMvnoDisplay;

assert(api,'MVNO display helper missing');
assert.match(bridge,/\/catalog\/mvno/,'MVNO server catalog endpoint missing');
assert.match(bridge,/WoongbiMvnoApi/,'MVNO server bridge global missing');
assert(!fs.existsSync('data/mvno-postpaid.json'),'Public MVNO source data must stay removed');
for(const marker of ['SMKT','SMSKT','IYAGISKT','IYAGIKT','IYAGILG','MMOBILE-1295','UPLUSE-1705','SKYLIFE-2069','UPLUSE-2390']){
  assert(!source.includes(marker),`Private assortment marker leaked into display helper: ${marker}`);
}

const groups=[
  {key:'light',title:'월 부담 가볍게',description:'가볍게'},
  {key:'daily',title:'일상용으로 균형 있게',description:'균형'},
  {key:'data',title:'데이터 넉넉하게',description:'넉넉하게'}
];
const plans={
  l1:{id:'L1',provider_id:'P1',name:'라이트1'},l2:{id:'L2',provider_id:'P1',name:'라이트2'},l3:{id:'L3',provider_id:'P2',name:'라이트3'},
  d1:{id:'D1',provider_id:'P1',name:'데일리1'},d2:{id:'D2',provider_id:'P2',name:'데일리2'},
  h1:{id:'H1',provider_id:'P2',name:'데이터1'}
};
const catalog={
  meta:{updated_at:'2026-10-01',store_reviewed_at:'2026-09-30'},
  providers:[{id:'P1',name:'통신사1'},{id:'P2',name:'통신사2'}],
  plans:Object.values(plans),
  groups,
  recommendations:{light:[plans.l1,plans.l2,plans.l3],daily:[plans.d1,plans.d2],data:[plans.h1]}
};

assert.equal(api.clean(catalog),catalog,'Server-prepared catalog should pass through unchanged');
const all=api.recommend(catalog,'all');
assert.equal(all.length,3);
assert.deepEqual(Array.from(all,row=>row.plan.id),['L1','D1','H1']);
assert.equal(new Set(all.map(row=>row.group.key)).size,3);
assert.deepEqual(Array.from(api.recommend(catalog,'light'),row=>row.plan.id),['L1','L2','L3']);
assert.deepEqual(Array.from(api.recommend(catalog,'daily'),row=>row.plan.id),['D1','D2']);
assert.deepEqual(Array.from(api.recommend(catalog,'data'),row=>row.plan.id),['H1']);
assert.equal(api.recommend(catalog,'unknown').length,0);

const empty=api.clean(null);
assert.deepEqual(Array.from(empty.providers),[]);
assert.deepEqual(Array.from(empty.plans),[]);
assert.equal(api.recommend(empty).length,0);
console.log('MVNO display uses server-prepared assortment without public store policy.');
