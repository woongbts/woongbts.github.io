'use strict';
const {chromium,devices}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({...devices['iPhone 14'],serviceWorkers:'block'});
 const page=await context.newPage();
 page.setDefaultTimeout(12000);
 page.on('pageerror',e=>console.log('PAGE_EXCEPTION',e.message));
 const origin='http://127.0.0.1:4173';
 const fake={ok:true,items:[{
  d:{id:'test-device',name:'갤럭시 A17',carrier:'KT',model_code:'SM-A175'},
  p:{id:'test-plan',name:'시니어 테스트 요금제',monthly_fee:33000,data:'5GB',voice:'무제한'},
  joinLabel:'번호이동',welfare:'none',lane:'가격 부담 적음',reasons:['저렴한 월요금'],
  best:{known:true,method:'support',monthly:38000,support:100000,inst:{monthly:5000},service:33000,total24:912000},
  support:{known:true,method:'support',monthly:38000,support:100000,inst:{monthly:5000},service:33000,total24:912000},
  contract:{known:true,method:'contract',monthly:39900,contractDiscount:11000,inst:{monthly:14000},service:25900,total24:957600}
 }]};
 await page.route('https://woongbi-quote-api.woongbts.workers.dev/recommend/purpose',route=>{
   const category=JSON.parse(route.request().postData()||'{}').category;
   return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({...fake,description:category+' 테스트 추천'})});
 });
 await page.route('https://woongbi-consent.woongbts.workers.dev/api/store-application-policy',route=>{
  return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({ok:true,policy:{version:'EASY-SMOKE',purpose:'상담 접수',items:{required:'성함·전화번호'},retention:'90일',refusal:'동의 거부 가능'}})});
 });
 await page.route('https://woongbi-consent.woongbts.workers.dev/api/recommendation-signals',route=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({ok:true,signals:{store:[]}})}));
 let sent=null;
 await page.route('https://woongbi-consent.woongbts.workers.dev/api/store-application',route=>{
  sent=JSON.parse(route.request().postData());
  return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({ok:true,receipt:{id:'test-123456',lookup_token:'fake-token'}})});
 });
 for(const purpose of ['senior','kids','value','premium']){
   await page.goto(origin+'/rates.html?tab=mobile&purpose='+purpose+'&src=home-easy',{waitUntil:'load'});
   await page.waitForFunction(key=>Boolean(document.querySelector('[data-purpose-category="'+key+'"].active') && !document.getElementById('purpose-recommend').hidden),purpose,{timeout:16000});
   assert.equal(await page.locator('#mobile-easy-intro').count(),1,'guide present');
   assert.equal(await page.locator('#mobile-easy-advanced:not([open])').count(),1,'advanced mode folded');
   await page.waitForSelector('#purpose-results .purpose-card',{timeout:16000});
   const btn=page.locator('#mobile-easy-see-results');
   await btn.click();
   assert.equal(await page.locator('#purpose-results .store-apply-btn').count(),1,'one action per result');
   console.log('PURPOSE_OK',purpose);
 }
 await page.locator('#purpose-results .store-apply-btn').first().click();
 await page.locator('#store-application-dialog[open]').waitFor();
 assert.equal(await page.locator('#store-application-inquiry').count(),1);
 assert.equal(await page.locator('.store-inquiry-optional:not([open])').count(),1);
 assert.equal(await page.locator('#store-application-name').isVisible(),true);
 assert.equal(await page.locator('#store-application-phone').isVisible(),true);
 await page.locator('#store-application-name').fill('테스트고객');
 await page.locator('#store-application-phone').fill('01012345678');
 await page.locator('#store-application-consent').check();
 await page.waitForTimeout(750);
 await page.locator('#store-application-submit').click();
 await page.locator('#store-application-success[open]').waitFor({timeout:9000});
 assert.equal(sent.category,'mobile');
 assert.equal(sent.product_name,'갤럭시 A17');
 assert.equal(sent.monthly,38000);
 assert.match(sent.detail,/공시지원금/);
 assert.match(sent.product_id,/test-device:test-plan/);
 console.log('PHONE_GUIDED_SMOKE_PASSED — 4 categories, quote context, consent form, mock receipt');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
