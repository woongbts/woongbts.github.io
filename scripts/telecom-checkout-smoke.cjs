const {chromium,devices}=require('playwright');
function check(ok,message){if(!ok)throw Error(message);}
(async()=>{
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({...devices['iPhone 14'],serviceWorkers:'block'});
 const page=await context.newPage();
 page.setDefaultTimeout(10000);
 page.on('pageerror',err=>console.log('BROWSER_ERROR',err.message));
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
 await page.goto(origin+'/',{waitUntil:'load'});
 await page.waitForTimeout(500);
 // 2026-11-04 the homepage picker became three entry actions plus a direct product
 // menu; the four phone purposes now live in that menu.
 await page.waitForSelector('#home-direct-toggle',{timeout:12000});
 await page.locator('#home-direct-toggle').click();
 await page.waitForSelector('#home-self-compare:not([hidden])',{timeout:10000});
 const names=['senior','kids','value','premium'];
 for(const type of names){
  const target=page.locator('#home-self-compare .home-direct-link[href*="purpose='+type+'"]');
  check(await target.count()===1,'Missing purpose link '+type);
 }
 if(await page.locator('#home-self-compare .home-direct-link[href*="purpose='+names[0]+'"]').count()!==1)throw Error('Homepage direct menu missing phone purposes');
 await page.locator('#home-direct-toggle').click();
 await page.waitForSelector('#home-self-compare',{state:'hidden',timeout:5000});
 // Mobile hides the floating AI launcher (customer-flow-20261104.css) and shows the
 // in-page AI entry instead, so open the panel from that entry and check its bounds.
 await page.waitForSelector('.customer-inline-ai',{timeout:10000});
 check(await page.locator('#woongbi-ai-launcher').isHidden(),'Mobile should not show the floating AI launcher');
 const inline=await page.evaluate(()=>{
  const button=document.querySelector('.customer-inline-ai')?.getBoundingClientRect();
  return {button:button&&{left:button.left,right:button.right,height:button.height},width:document.documentElement.clientWidth};
 });
 check(inline.button&&inline.button.left>=0&&inline.button.right<=inline.width+1,'Inline AI entry horizontal clipping: '+JSON.stringify(inline));
 check(inline.button.height>=40,'Inline AI entry too small to tap: '+JSON.stringify(inline));
 await page.locator('.customer-inline-ai').first().click();
 await page.waitForSelector('#woongbi-ai-panel.open',{timeout:5000});
 await page.locator('#woongbi-ai-panel .wb-ai-close').click();
 await page.waitForSelector('#woongbi-ai-panel',{state:'hidden',timeout:5000});
 // The iPhone duo preorder/calculator page was retired on 2026-10-23; it must keep
 // sending visitors to the live homepage instead of a dead calculator.
 const retired=await page.evaluate(async()=>{
  const response=await fetch('/iphone-duo/');
  const body=await response.text();
  return {status:response.status,home:body.includes('woongbts.kr/'),calculator:body.includes('duo-calc-carrier')};
 });
 check(retired.status===200,'Retired preorder page must stay reachable: '+JSON.stringify(retired));
 check(retired.home,'Retired preorder page must point visitors home: '+JSON.stringify(retired));
 check(!retired.calculator,'Retired preorder page must not resurrect the old calculator');
 console.log('RETIRED PREORDER PAGE',JSON.stringify(retired));
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
 // Secondary actions sit under the collapsed "상세 조건·다른 상담 방법" details.
 const more=page.locator('#purpose-results .customer-card-more').first();
 if(await more.count()){
  const open=await more.evaluate(el=>el.open);
  if(!open)await more.locator('summary').click();
 }
 await visit.scrollIntoViewIfNeeded();
 await visit.click();
 await page.waitForURL('**/visit.html?src=rates',{timeout:5000});
 const product=await page.locator('#visit-product').textContent();
 check(product&&!product.includes('휴대폰·알뜰폰·인터넷 상담'),'Visit booking did not preserve the selected phone');
 const booking=await page.locator('#visit-book').getAttribute('href');
 check(booking.includes('booking.naver.com'),'Visit handoff lost Naver booking link');
 console.log('Telecom iPhone shopping flow passed: four categories, purpose deeplinks, AI button, phone inquiry and visit handoff');
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});