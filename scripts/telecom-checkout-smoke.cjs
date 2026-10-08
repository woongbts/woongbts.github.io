const {chromium,devices}=require('playwright');
function check(ok,message){if(!ok)throw Error(message);}
(async()=>{
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({...devices['iPhone 14']});
 const page=await context.newPage();
 const origin='http://127.0.0.1:4173';
 await page.route('https://woongbi-consent.woongbts.workers.dev/api/store-application-policy',async route=>{
  return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':origin},body:JSON.stringify({ok:true,policy:{version:'SMOKE',purpose:'상담신청',items:{required:'이름, 전화번호'},retention:'90일',refusal:'거절 가능'}})});
 });
 await page.route('https://woongbi-consent.woongbts.workers.dev/api/recommendation-signals',route=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':origin},body:JSON.stringify({ok:true,signals:{store:[]}})}));
 let submit=null;
 await page.route('https://woongbi-consent.woongbts.workers.dev/api/store-application',async route=>{
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':origin,'access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'content-type'}});
  submit=JSON.parse(route.request().postData()||'{}');
  return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':origin},body:JSON.stringify({ok:true,receipt:{id:'smoke-test-1234',lookup_token:'fake-test-token'}})});
 });
 await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('#home-order-choices .home-order-option',{timeout:12000});
 const labels=await page.locator('#home-order-choices .home-order-option strong').allTextContents();
 check(JSON.stringify(labels)===JSON.stringify(['효도폰','키즈폰','가성비폰','프리미엄폰']), 'Homepage should show only four phone purposes: '+JSON.stringify(labels));
 const names=['senior','kids','value','premium'];
 for(const type of names){
  const target=page.locator('#home-order-choices .home-order-option[href*="purpose='+type+'"]');
  check(await target.count()===1,'Missing purpose link '+type);
 }
 await page.waitForSelector('#woongbi-ai-launcher',{timeout:10000});
 const geometry=await page.evaluate(()=>{
  const ai=document.getElementById('woongbi-ai-launcher')?.getBoundingClientRect();
  const bar=document.querySelector('.mobile-bar')?.getBoundingClientRect();
  return {ai:ai&&{left:ai.left,right:ai.right,top:ai.top,bottom:ai.bottom},bar:bar&&{top:bar.top},width:document.documentElement.clientWidth};
 });
 check(geometry.ai&&geometry.ai.left>=0&&geometry.ai.right<=geometry.width+1,'AI button horizontal clipping: '+JSON.stringify(geometry));
 check(geometry.bar&&geometry.ai.bottom<=geometry.bar.top+1,'AI button covered by mobile action bar: '+JSON.stringify(geometry));
 for(const purpose of names){
  await page.goto(origin+'/rates.html?tab=mobile&purpose='+purpose+'&src=home-easy',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1100);
  const diagnostic=await page.evaluate((key)=>({
    url:location.href,
    tab:document.querySelector('.rate-tab.active')?.dataset.tab,
    panelHidden:document.querySelector('.rate-panel[data-panel="mobile"]')?.hidden,
    mode:document.querySelector('[data-mobile-mode].active')?.dataset.mobileMode,
    category:[...document.querySelectorAll('[data-purpose-category]')].filter(x=>x.classList.contains('active')).map(x=>x.dataset.purposeCategory),
    sectionHidden:document.getElementById('purpose-recommend')?.hidden,
    targetVisible:Boolean(document.querySelector('[data-purpose-category="'+key+'"]')?.getClientRects().length)
  }),purpose);
  console.log('PURPOSE_DIAGNOSTIC',purpose,JSON.stringify(diagnostic));
  await page.waitForSelector('[data-purpose-category="'+purpose+'"].active',{timeout:10000});
  check(await page.locator('#purpose-recommend:not([hidden])').count()===1,'Calculator purpose content hidden: '+purpose);
 }
 await page.goto(origin+'/rates.html?tab=mobile&purpose=kids&src=home-easy',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('[data-purpose-category="kids"].active',{timeout:15000});
 await page.waitForSelector('#purpose-results .purpose-card',{timeout:15000});
 await page.waitForSelector('#purpose-results .store-apply-btn',{timeout:10000});
 await page.locator('#purpose-results .store-apply-btn').first().click();
 await page.waitForSelector('#store-application-dialog[open]',{timeout:4000});
 check(await page.locator('#store-internet-fields:not([hidden])').count()===0,'Internet-specific fields should not appear for phones');
 await page.locator('#store-application-name').fill('테스트고객');
 await page.locator('#store-application-phone').fill('01012345678');
 await page.locator('#store-application-consent').check();
 await page.waitForTimeout(850);
 await page.locator('#store-application-submit').click();
 await page.waitForSelector('#store-application-success[open]',{timeout:7000});
 check(submit&&submit.category==='mobile'&&submit.product_name&&submit.phone==='01012345678','Phone application should send selected phone context via consent-gated API');
 await page.locator('#store-application-success-confirm').click();
 const visit=page.locator('#purpose-results .store-visit-btn').first();
 check(await visit.count()===1,'Purpose-based phone visit handoff missing');
 await visit.click();
 await page.waitForURL('**/visit.html?src=rates',{timeout:5000});
 const product=await page.locator('#visit-product').textContent();
 check(product&&!product.includes('휴대폰·알뜰폰·인터넷 상담'),'Visit booking did not preserve the selected phone');
 const booking=await page.locator('#visit-book').getAttribute('href');
 check(booking.includes('booking.naver.com'),'Visit handoff lost Naver booking link');
 console.log('Telecom iPhone shopping flow passed: four categories, purpose deeplinks, AI button, phone inquiry and visit handoff');
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});