'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');

const root = 'http://127.0.0.1:4173';
const agent = 'https://agent.freet.co.kr/self/custSel?usimType=U&storeAgentIdKey=PS2200532';

async function main() {
  const code = fs.readFileSync('assets/freet-enrollment.js','utf8');
  const html = fs.readFileSync('rates.html','utf8');
  assert.ok(!code.includes('storeAgentIdKey'), 'partner destination should be on the branded landing page');
  assert.ok(!html.includes('storeAgentIdKey'), 'calculator should only link internally');
  assert.ok(html.includes('freet-postpaid-feature') && html.includes('freet-prepaid-selected'));
  assert.ok(html.includes('프리티 선불 요금제는 온라인 신청이 가능합니다.'));
  assert.ok(fs.readFileSync('freet/apply/index.html','utf8').includes(agent.replace('&','&amp;')));

  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
    const errors = [];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://woongbi-quote-api.woongbts.workers.dev/catalog/mvno',route => {
      if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*'}});
      const plans=[
        {id:'FREETSKT-1416',provider_id:'FREETSKT',name:'심플 200분1G',network:'SKT',monthly_fee:3520,special_monthly_fee:3520,regular_monthly_fee:12100,voice:'200분',sms:'50건',data:'1GB',source_order:1},
        {id:'FREETKT-1568',provider_id:'FREETKT',name:'프리티든든한 6G',network:'KT',monthly_fee:8800,special_monthly_fee:8800,regular_monthly_fee:28600,voice:'300분',sms:'300건',data:'6GB',source_order:9},
        {id:'FREETLG-2178',provider_id:'FREETLG',name:'freeT 안심 15G+1M',network:'LGU+',monthly_fee:31900,special_monthly_fee:31900,regular_monthly_fee:40700,voice:'무제한',sms:'기본제공',data:'15GB+1Mbps 무제한',source_order:15},
        {id:'OTHER-1',provider_id:'OTHER',name:'다른 통신사 상품',network:'KT',monthly_fee:10000,data:'2GB'}
      ];
      const catalog={meta:{updated_at:'2026-11-04'},providers:[
        {id:'FREETSKT',name:'FREET(SKT)',network:'SKT'},{id:'FREETKT',name:'FREET(KT)',network:'KT'},
        {id:'FREETLG',name:'FREET(LGU+)',network:'LGU+'},{id:'OTHER',name:'다른 통신사',network:'KT'}
      ],plans,groups:[],recommendations:{}};
      return route.fulfill({status:200,contentType:'application/json',
        headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({ok:true,catalog})});
    });
    await page.goto(root+'/rates.html?tab=mvno',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => document.querySelectorAll('#freet-postpaid-list .freet-plan-card').length===3,{timeout:30000});
    const cards=await page.locator('#freet-postpaid-list .freet-plan-card').allTextContents();
    assert.ok(cards.some(x=>x.includes('SKT'))&&cards.some(x=>x.includes('KT'))&&cards.some(x=>x.includes('LG U+')),cards.join('; '));
    assert.equal(await page.locator('#freet-postpaid-list a.freet-apply-link').count(),3);
    assert.match(await page.locator('#freet-postpaid-list a.freet-apply-link').first().getAttribute('href'),/^\/freet\/apply\/\?type=postpaid&plan=FREET/);
    await page.locator('#freet-postpaid-list .freet-detail-button').first().click();
    await page.waitForFunction(()=>document.querySelector('#freet-postpaid-selected')?.hidden===false,{timeout:12000});
    assert.equal(await page.locator('#freet-postpaid-selected-link').getAttribute('href'),
      '/freet/apply/?type=postpaid&plan=FREETSKT-1416');
    console.log('POSTPAID_FREET_OK',cards.map(x=>x.slice(0,90)));

    await page.locator('[data-tab="prepaid"]').click();
    await page.waitForFunction(()=>document.querySelectorAll('#prepaid-recommend-list .prepaid-recommend-card').length===3,{timeout:12000});
    const buttons=await page.locator('#prepaid-recommend-list [data-prepaid-recommend]').evaluateAll(x=>x.map(y=>y.dataset.prepaidRecommend));
    assert.deepEqual(buttons,['PRE-FREETSKT-1518','PRE-FREETKT-1429','PRE-FREETLG-1523']);
    assert.equal(await page.locator('#prepaid-recommend-list a.freet-apply-link').count(),3);
    await page.locator('[data-prepaid-recommend="PRE-FREETKT-1429"]').click();
    await page.waitForFunction(()=>document.querySelector('#freet-prepaid-selected')?.hidden===false,{timeout:12000});
    assert.equal(await page.locator('#prepaid-provider').inputValue(),'FREETKT');
    assert.equal(await page.locator('#freet-prepaid-selected-link').getAttribute('href'),
      '/freet/apply/?type=prepaid&plan=PRE-FREETKT-1429');
    console.log('PREPAID_FREET_OK',buttons);

    await page.goto(root+'/freet/apply/?type=prepaid',{waitUntil:'domcontentloaded'});
    assert.match(await page.locator('h1').innerText(),/선불폰/);
    assert.equal(await page.locator('#freet-official-apply').getAttribute('href'),agent);
    assert.match(await page.locator('main').innerText(),/유심 발송/);
    assert.match(await page.locator('main').innerText(),/신청서 접수만으로 즉시 개통되지 않습니다/);
    await page.goto(root+'/freet/apply/?type=postpaid',{waitUntil:'domcontentloaded'});
    assert.match(await page.locator('h1').innerText(),/후불 알뜰폰/);
    assert.equal(await page.locator('#freet-official-apply').getAttribute('href'),agent);
    console.log('BRANDED_PARTNER_FLOW_OK');
    if(errors.length) console.warn('Other page script errors observed:',errors.slice(0,4));
  } finally {
    await browser.close();
  }
}
main().catch(e=>{console.error(e);process.exit(1)});
