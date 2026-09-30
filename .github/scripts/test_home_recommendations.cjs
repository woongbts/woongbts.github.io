const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ctx={window:{},document:{getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({}),head:{appendChild(){}}},console,setTimeout(){},URL,location:{origin:'https://woongbts.github.io'},fetch:async url=>({json:async()=>JSON.parse(fs.readFileSync(url.split('?')[0],'utf8'))})};
vm.createContext(ctx);
for(const file of ['assets/plan-eligibility.js','assets/store-sale-policy.js','assets/recommendation-engine-v2.js'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
(async()=>{
 const policy=ctx.window.WoongbiPlanEligibility;
 for(const name of ['데이터플랜80GB(Uth+30GB)','데이터플랜80GB(유쓰+30GB)','데이터플랜80GB(복지)','현역병사 데이터 33'])assert.equal(policy.allowed({name,age_limit:'ALL'},'premium'),false,name);
 assert.ok(policy.labels({name:'데이터플랜80GB(Uth+30GB)',age_limit:'ALL'}).includes('청년 전용'));
 assert.ok(policy.labels({name:'시니어',age_limit:'O_65'}).includes('만 65세 이상'));
 assert.equal(policy.allowed({name:'시니어',age_limit:'O_65'},'senior'),true);
 assert.equal(policy.allowed({name:'시니어',age_limit:'O_65'},'general'),false);
 const engine=ctx.window.WoongbiRecommendationV2;
 await engine.ready;
 assert.equal(engine.status().ready,true);
 for(const category of ['senior','value','premium']){
   const choices=engine.recommend(category);
   assert.ok(choices.length>0,category);
   for(const c of choices){
     assert.equal(policy.allowed(c.p,category),true);
     const url=new URL(engine.detailUrl(c));
     assert.equal(url.searchParams.get('d'),c.d.id);
     assert.equal(url.searchParams.get('p'),c.p.id);
     assert.equal(url.searchParams.get('m'),c.best.method);
     assert.equal(url.searchParams.get('w'),'none');
     assert.ok(c.best.monthly>0);
   }
 }
 const html=fs.readFileSync('index.html','utf8');
 assert.equal(html.includes('이런 분들이 많이 찾아오세요'),false);
 assert.ok(html.includes('블로그·SNS'));
 const legacy=fs.readFileSync('assets/site-pro-legacy.min.js','utf8');
 assert.ok(legacy.includes('https://m.booking.naver.com/booking/6/bizes/281910'));
 assert.equal(legacy.includes('bookingRedirectUrl='),false);
 console.log('Homepage recommendations share calculator conditions; dedicated eligibility, SNS preservation, compact services and direct booking passed');
})().catch(e=>{console.error(e);process.exitCode=1});
