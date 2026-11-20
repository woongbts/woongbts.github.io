'use strict';
// Homepage EASY PICK entry (2026-11 three-action layout): 상담 / 상품 찾기 / 요금 비교 must stay
// three distinct actions with distinct labels, and every product deep link must stay reachable.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=path=>fs.readFileSync(path,'utf8');
const homepage=read('index.html');
const rates=read('rates.html');
const entry=read('assets/simple-entry-20261104.js');
const direct=read('assets/rates-deeplink.js');
const styles=read('assets/simple-entry-20261104.css');
new vm.Script(entry,{filename:'simple-entry-20261104.js'});
new vm.Script(direct,{filename:'rates-deeplink.js'});

// 1. Three entry actions, each with its own job: 카톡 상담 · 상품 찾기 · 요금 비교.
assert.match(homepage,/class="home-entry-grid" id="home-order-choices" aria-label="이용 방법 선택"/);
assert.match(homepage,/<a class="home-entry-primary" href="http:\/\/pf\.kakao\.com\/_nWwNT\/chat" target="_blank" rel="noopener noreferrer"><strong>카톡으로 물어보기<\/strong><span>[^<]+<\/span>/,'카톡 상담 entry keeps the store chat link');
assert.match(homepage,/<button type="button" class="home-direct-toggle" id="home-direct-toggle" aria-controls="home-self-compare" aria-expanded="false"><strong>상품 골라보기<\/strong><span>[^<]+<\/span>/,'product entry is a real toggle button');
assert.match(homepage,/<a class="home-entry-secondary" id="home-compare-open" href="\/rates\.html\?tab=mobile&amp;src=home-easy-fee"><strong>월요금 계산하기<\/strong><span>[^<]+<\/span>/,'fee comparison entry goes to the calculator');
const entryLabels=['카톡으로 물어보기','상품 골라보기','월요금 계산하기'];
assert.equal(new Set(entryLabels).size,3);
for(const label of entryLabels)assert.ok(homepage.includes('<strong>'+label+'</strong>'),'missing entry label: '+label);
// The old overlapping pair (상품별 비교·개통신청 / 직접 비교해 볼게요) must not come back.
assert.ok(!homepage.includes('상품별 비교·개통신청'),'overlapping product entry label returned');
assert.ok(!homepage.includes('직접 비교해 볼게요'),'overlapping compare entry label returned');
assert.equal((homepage.match(/class="home-entry-(primary|secondary)"/g)||[]).length,2);
for(const marker of ['aria-hidden="true"','<p class="home-entry-phone"><a href="tel:0513437677">'])assert.ok(homepage.includes(marker),'entry area loses '+marker);

// 2. The product menu keeps its anchor, its disclosure state and every deep link.
assert.match(homepage,/id="home-self-compare" hidden aria-labelledby="home-direct-title"/,'product menu must start closed');
assert.match(homepage,/href="#home-self-compare"/,'an in-page shortcut to the product menu must remain');
for(const link of [
  '/rates.html?tab=mobile&amp;purpose=senior&amp;src=home-direct',
  '/rates.html?tab=mobile&amp;purpose=kids&amp;src=home-direct',
  '/rates.html?tab=studyphone&amp;src=home-direct',
  '/rates.html?tab=mobile&amp;purpose=value&amp;src=home-direct',
  '/rates.html?tab=mobile&amp;purpose=premium&amp;src=home-direct',
  '/rates.html?tab=mvno&amp;src=home-direct',
  '/freet/apply/?type=postpaid',
  '/freet/apply/?type=prepaid',
  '/rates.html?tab=internet&amp;src=home-direct',
  '/rental/?src=home-direct'
])assert.ok(homepage.includes('href="'+link+'"'),'product menu lost deep link: '+link);
assert.match(homepage,/class="home-order-disclaimer"/,'price expectations disclaimer removed');

// 3. The picker sits above the marketing hero and loads its own assets.
assert.ok(homepage.indexOf('id="quick-order"')<homepage.indexOf('class="hero-grid hero-grid-single"'),'quick picker must appear above the marketing hero');
assert.match(homepage,/src="\/assets\/simple-entry-20261104\.js\?v=[a-zA-Z0-9._-]+"/);
assert.match(homepage,/href="\/assets\/quick-order\.css\?v=[a-zA-Z0-9._-]+"/);
assert.match(rates,/id="rate-easy-flow"/);
assert.match(rates,/rates-deeplink\.js\?v=[a-zA-Z0-9._-]+/);
assert.match(rates,/quick-order\.css/);

// 4. The toggle really opens the menu and keeps aria state in sync.
assert.match(entry,/querySelectorAll\('a\[href="#home-self-compare"\]'\)/);
assert.match(entry,/panel\.hidden=!expanded/);
assert.match(entry,/location\.hash==='#home-self-compare'/);
assert.match(entry,/상품 골라보기/);
assert.match(entry,/상품 메뉴 닫기/);
assert.match(entry,/휴대폰·알뜰폰·인터넷·렌탈/);
assert.match(direct,/function restoreInternetQuick\(/);
assert.match(direct,/function restoreMobileDirect\(/);
assert.match(direct,/function showQuickJourney\(/);

// 5. Mobile layout and entry colours stay defined.
assert.match(styles,/@media\(max-width:640px\)/);
for(const selector of ['.home-entry-primary','.home-direct-toggle','.home-direct-link','.home-entry-grid']){
  assert.ok(styles.includes(selector),'missing entry style '+selector);
}
console.log('Home EASY PICK: three distinct entry actions, product deep links, disclosure state and assets passed.');
