const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const ctx={window:{},document:{getElementById:()=>null}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('assets/plan-eligibility.js','utf8'),ctx);

const policy=ctx.window.WoongbiPlanEligibility;
for(const name of ['데이터플랜80GB(Uth+30GB)','데이터플랜80GB(유쓰+30GB)','데이터플랜80GB(복지)','현역병사 데이터 33']){
  assert.equal(policy.allowed({name,age_limit:'ALL'},'premium'),false,name);
}
assert.ok(policy.labels({name:'데이터플랜80GB(Uth+30GB)',age_limit:'ALL'}).includes('청년 전용'));
assert.ok(policy.labels({name:'시니어',age_limit:'O_65'}).includes('만 65세 이상'));
assert.equal(policy.allowed({name:'시니어',age_limit:'O_65'},'senior'),true);
assert.equal(policy.allowed({name:'시니어',age_limit:'O_65'},'general'),false);

assert.equal(fs.existsSync('assets/recommendation-engine-v2.js'),false,'public V2 recommendation engine must stay removed');
const bridge=fs.readFileSync('assets/recommend-api-bridge.min.js','utf8');
assert.ok(bridge.includes("post('/recommend/purpose'"),'purpose recommendations must use server API');
assert.ok(bridge.includes("post('/recommend/quick'"),'quick recommendations must use server API');
assert.ok(bridge.includes('methodMemory'),'selected support/contract method should survive redraws');
assert.ok(bridge.includes('aria-pressed'),'method switch must expose pressed state');
assert.ok(bridge.includes('openDirect({...item,best:selected},join)'),'direct calculator must receive the selected recommendation method');
assert.ok(bridge.includes('consultText(item,state.category,join,selected)'),'consultation must use the selected recommendation method');

const handoff=fs.readFileSync('assets/quote-handoff.js','utf8');
assert.ok(handoff.includes('/assets/recommend-api-bridge.min.js?v=20261001-2'));
const pwa=fs.readFileSync('assets/pwa.min.js','utf8');
assert.equal(pwa.includes('recommendation-engine-v2.js'),false);
const sw=fs.readFileSync('sw.js','utf8');
assert.equal(sw.includes('recommendation-engine-v2.js'),false);
assert.ok(sw.includes('/assets/recommend-api-bridge.min.js'));

const html=fs.readFileSync('index.html','utf8');
assert.equal(html.includes('이런 분들이 많이 찾아오세요'),false);
assert.ok(html.includes('블로그·SNS'));
const legacy=fs.readFileSync('assets/site-pro-legacy.min.js','utf8');
assert.ok(legacy.includes('https://m.booking.naver.com/booking/6/bizes/281910'));
assert.equal(legacy.includes('bookingRedirectUrl='),false);

console.log('Server recommendation bridge, shared eligibility, selected-method handoff and homepage regressions passed.');
