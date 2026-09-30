const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function extract(source, name) {
  const start = source.indexOf('function '+name+'(');
  assert.ok(start >= 0, name+' missing');
  const open = source.indexOf('{', start);
  let depth=1, end=open+1;
  for (; depth && end<source.length; end++) {
    if(source[end]==='{') depth++;
    if(source[end]==='}') depth--;
  }
  assert.equal(depth,0);
  return source.slice(start,end);
}
const calculator=fs.readFileSync('src/rates.js','utf8');
const engine=fs.readFileSync('assets/recommendation-engine-v2.js','utf8');
const num=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const d={id:'test-device',carrier:'LGU+',retail_price:1254000},p={id:'test-plan',monthly_fee:66000};
const state={catalog:{mobile_supports:[]},supports:{support_schedules:[{carrier:'LGU+',device_ids:[d.id],join_types:['번호이동'],amounts:{[p.id]:3120000}}]}};
const ctx={window:{},num,n:num,state,o:state.catalog,a:state.supports.support_schedules,clean:v=>String(v||'').replace(/\s+/g,'').toLowerCase()};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync("assets/plan-eligibility.js","utf8"),ctx);
for(const name of ['validPublicSupport','supportFor','audienceAllowed'])vm.runInContext(extract(engine,name),ctx);
for(const name of ['wbValidPublicSupport','N'])vm.runInContext(extract(calculator,name),ctx);
for(const bad of [3120000,-1,1.5,null,'',Infinity]){
 assert.equal(ctx.validPublicSupport(bad,d),false);
 assert.equal(ctx.wbValidPublicSupport(bad,d),false);
}
assert.equal(ctx.supportFor(d,p,'번호이동'),null);
assert.equal(ctx.N(d,p,'번호이동'),null);
state.supports.support_schedules[0].amounts[p.id]=390000;
assert.equal(ctx.supportFor(d,p,'번호이동'),390000);
assert.equal(ctx.N(d,p,'번호이동').public_support,390000);
state.catalog.mobile_supports=[{device_id:d.id,plan_id:p.id,join_type:'번호이동',public_support:3120000}];
assert.equal(ctx.supportFor(d,p,'번호이동'),null);
assert.equal(ctx.N(d,p,'번호이동'),null);
assert.equal(ctx.audienceAllowed({name:'데이터플랜80GB(복지)',age_limit:'ALL'},'premium'),false);
assert.equal(ctx.audienceAllowed({name:'데이터플랜MAX',age_limit:'ALL'},'premium'),true);
console.log('Support integrity: invalid source amounts rejected in both calculators; verified 390000 accepted; welfare plan excluded from general recommendations.');
