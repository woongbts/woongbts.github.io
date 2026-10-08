'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('rental/index.html','utf8');
const source=fs.readFileSync('rental/assets/ai-recommend.js','utf8');
const css=fs.readFileSync('rental/assets/ai-recommend.css','utf8');
const loader=fs.readFileSync('rental/assets/ai-recommend-loader.js','utf8');
new vm.Script(source,{filename:'ai-recommend.js'});
assert.equal((html.match(/data-ai-step="\d+"/g)||[]).length,3,'3 step form');
assert.equal((html.match(/data-ai-step-indicator="\d+"/g)||[]).length,3,'3 progress chips');
assert.equal((html.match(/name="ai-priority"/g)||[]).length,3,'3 preference types');
assert.ok(html.indexOf('id="ai-budget"')>html.indexOf('class="ai-advanced-details"'),'budget is optional');
assert.ok(html.includes('id="ai-budget-strict"'),'optional hard budget retained');
assert.ok(html.includes('id="ai-management"')&&html.includes('id="ai-brand"'),'previous choice controls retained');
assert.match(css,/\.ai-priority-card/);
assert.match(html,/ai-recommend\.css\?v=20261008-preference2/);
assert.match(html,/ai-recommend-loader\.js\?v=20261008-preference2/);
assert.match(loader,/ai-recommend\.js\?v=20261008-preference2/);
assert.doesNotMatch(source,/showAiStep\(4\)/);
assert.match(source,/priorityInputs\.find\(input => input\.checked\)/);
assert.match(source,/u\.searchParams\.set\('priority'/);
const start=source.indexOf('  function chooseOption(product, criteria) {');
const end=source.indexOf('  function reasonText(item, index) {',start);
assert.ok(start>0&&end>start,'option and ranking source found');
const fixture=[
  {id:'cost',name:'저가형',brand:'COWAY',category:'정수기',options:[{monthly:19900,gift:20000,term:60,management:'self'}]},
  {id:'balance',name:'균형형',brand:'COWAY',category:'정수기',options:[{monthly:26900,gift:155000,term:60,management:'visit'}]},
  {id:'gift',name:'혜택형',brand:'COWAY',category:'정수기',options:[{monthly:45900,gift:350000,term:60,management:'visit'}]},
  {id:'other',name:'차선형',brand:'CUCKOO',category:'정수기',options:[{monthly:49000,gift:100000,term:60,management:'self'}]}
];
const context={
  products:fixture,
  salesSignals:new Map(),
  validOptions:p=>p.options,
  managementMatch:(o,m)=>m==='self'?o.management==='self':m==='visit'?o.management==='visit':true,
  productText:p=>p.name.toLowerCase(),
  brandLabel:b=>b,
  brandRank:b=>b==='COWAY'?1:4,
  FEATURE_DEFS:{ice:{label:'얼음',re:/얼음/}},
  requestedFeatures:()=>[],
  keywordTokens:()=>[],
  won:x=>String(x)+'원'
};
vm.createContext(context);
vm.runInContext(source.slice(start,end)+'\nthis.testApi={chooseOption,recommend};',context);
const criteria={category:'정수기',budget:0,brand:'',management:'',query:'',strictBudget:false,strictBrand:false,strictManagement:false,mustFeatures:[],priority:'balanced'};
const kinds=new Set(['monthly','balanced','gift']);
for(const priority of kinds){
  const result=context.testApi.recommend({...criteria,priority});
  assert.equal(result.length,3,'3 distinct products: '+priority);
  assert.equal(result[0].kind,priority,'requested type comes first');
  assert.equal(new Set(result.map(r=>r.product.id)).size,3,'no duplicated products');
  assert.deepEqual(new Set(result.map(r=>r.kind)),kinds,'all 3 useful comparison types');
}
assert.equal(context.testApi.recommend({...criteria,priority:'monthly'})[0].product.id,'cost','cost prioritizes affordability');
assert.equal(context.testApi.recommend({...criteria,priority:'gift'})[0].product.id,'gift','gift prioritizes benefits');
const capped=context.testApi.recommend({...criteria,budget:30000,strictBudget:true});
assert.ok(capped.length>0&&capped.every(x=>x.monthly<=30000),'strict budget never over limit');
const preferred=context.testApi.recommend({...criteria,brand:'CUCKOO',strictBrand:true});
assert.ok(preferred.every(x=>x.product.brand==='CUCKOO'),'required brand filter retained');
const requiredManagement=context.testApi.recommend({...criteria,management:'visit',strictManagement:true});
assert.ok(requiredManagement.every(x=>x.option.management==='visit'),'required management filter retained');
const noProducts=context.testApi.recommend({...criteria,budget:10000,strictBudget:true});
assert.equal(noProducts.length,0,'no fake affordable products');
console.log('Rental AI: wizard, priorities, shares, strict constraints, ranking and uniqueness passed.');
