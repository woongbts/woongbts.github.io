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

const homeBridge=fs.readFileSync('assets/home-recommend-api.min.js','utf8');
assert.ok(homeBridge.includes("BASE+'/recommend/purpose'"),'homepage must use private purpose recommendation API');
assert.ok(homeBridge.includes('const rows={senior:[],value:[],premium:[]}'),'homepage recommendation categories changed');
assert.ok(homeBridge.includes('window.WoongbiRecommendationV2'),'homepage compatibility API missing');
assert.ok(homeBridge.includes("q.set('d',item.d.id)"),'homepage recommendation deep link missing device');
assert.ok(homeBridge.includes("q.set('p',item.p.id)"),'homepage recommendation deep link missing plan');
assert.ok(homeBridge.includes("q.set('m',item.best.method)"),'homepage recommendation deep link missing discount method');

const handoff=fs.readFileSync('assets/quote-handoff.js','utf8');
assert.ok(handoff.includes('/assets/recommend-api-bridge.min.js?v=20261001-2'));
const pwa=fs.readFileSync('assets/pwa.min.js','utf8');
assert.equal(pwa.includes('recommendation-engine-v2.js'),false);
const sw=fs.readFileSync('sw.js','utf8');
assert.equal(sw.includes('recommendation-engine-v2.js'),false);
assert.ok(sw.includes('/assets/recommend-api-bridge.min.js'));
assert.ok(sw.includes('/assets/home-recommend-api.min.js'));

const html=fs.readFileSync('index.html','utf8');
assert.equal(html.includes('recommendation-engine-v2.js'),false,'homepage must not load removed V2 engine');
assert.ok(html.includes('/assets/home-intelligence-loader.js?'),'homepage intelligence lazy loader missing');
const homeLoader=fs.readFileSync('assets/home-intelligence-loader.js','utf8');
assert.ok(homeLoader.includes(html.match(/src="(\/assets\/home-recommend-api\.min\.js\?[^\"]+)"/)?.[1]||'missing-home-bridge'),'homepage lazy loader must load server recommendation bridge');
assert.equal(html.includes('이런 분들이 많이 찾아오세요'),false);
assert.ok(html.includes('블로그·SNS'));
const storefront=fs.readFileSync('assets/site-pro.min.js','utf8');
assert.ok(storefront.includes('갤럭시 A18 LTE·갤럭시 버디5'),'homepage senior heading must match pinned device');
assert.ok(storefront.includes('WoongbiRecommendationV2'),'homepage must render server recommendations');
assert.equal(storefront.includes('bookingRedirectUrl='),false);


// Regression check: featured device IDs and rate-plan IDs must exist in the current
// public catalog. A removed A17 entry previously made the homepage show "금액 확인 중".
const publicCatalog=JSON.parse(fs.readFileSync('data/catalog.json','utf8'));
const publicPlans=JSON.parse(fs.readFileSync('data/plans.json','utf8'));
const pinnedDevices=[...homeBridge.matchAll(/\bd:\{id:'([^']+)'/g)].map(match=>match[1]);
const pinnedPlans=[...homeBridge.matchAll(/\bp:\{id:'([^']+)'/g)].map(match=>match[1]);
assert.equal(pinnedDevices.length,3,'expected two senior devices and one value device');
assert.equal(pinnedDevices.length,pinnedPlans.length,'featured device/plan pin count mismatch');
for(let i=0;i<pinnedDevices.length;i++){
  const device=publicCatalog.devices.find(row=>row.id===pinnedDevices[i]);
  assert.ok(device,'featured device missing from latest catalog: '+pinnedDevices[i]);
  const plan=publicPlans.mobile_plans.find(row=>row.id===pinnedPlans[i]);
  assert.ok(plan,'featured plan missing from latest catalog: '+pinnedPlans[i]);
  assert.equal(plan.carrier,device.carrier,'featured carrier mismatch: '+device.id);
  assert.ok(device.eligible_plan_ids.includes(plan.id),'featured device-plan pairing is not eligible: '+device.id);
}
assert.equal(pinnedDevices[0],'SKT-XD-3065','senior homepage must use currently listed Galaxy A18 LTE');
assert.equal(homeBridge.includes('SKT-XD-2824'),false,'removed A17 must not be pinned on homepage');
const seniorPin=fs.readFileSync('assets/senior-a17-first.js','utf8');
assert.ok(seniorPin.includes("id:'SKT-XD-3065'"),'senior calculator pin must match homepage');

console.log('Server recommendation bridges, shared eligibility, selected-method handoff and homepage regressions passed.');

assert.ok(html.indexOf('src="/assets/home-recommend-api.min.js') < html.indexOf('src="assets/site-pro.min.js'), 'homepage API must initialize before storefront rendering');
assert.ok(homeLoader.includes('script[src='), 'lazy loader must skip already loaded recommendation bridge');
