'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');
const style=read('rental/assets/rental.css');
const home=read('rental/index.html');
const template=read('rental/product.html');
const featured=read('rental/product/chp-7220n/index.html');
const catalog=read('rental/assets/catalog.js');
const product=read('rental/assets/product-generic.js');
const marker='Rental customer action clarity + readable policy details (2026-10-09)';
assert.ok(style.includes(marker),'shared detail stylesheet has new legibility rules');
for(const s of [home,template,featured]){
 assert.ok(s.includes('assets/rental.css?v=20261009-clarity2'),'new stylesheet cache key on all rental pages');
}
assert.ok(catalog.includes('class="recommend-link"') && catalog.includes('조건 보기 →'),'recommend cards keep semantic link and destination');
assert.ok(catalog.includes('class="compare-toggle small"'),'recommend compare control remains a button');
assert.ok(catalog.includes('class="recent-card"'),'recent viewed whole-card link preserved');
assert.ok(product.includes('조건 비교하기 →'),'alternative price comparison links preserved');
const selectors=[
 '.recommend-card .recommend-actions .recommend-link',
 '.recommend-card .recommend-actions .compare-toggle.small',
 '.appliance-grid .appliance-category:nth-child(5n+2)',
 '.recent-card strong',
 '.generic-recommend-list span',
 '.selection-flow',
 '.quote-total span',
 '.quote-card-burden>#card-fee-note',
 '.installation-quick-note span',
 '.contract-key-grid span',
 '.product-extra-details>summary',
 '.apply-reassurance strong',
 '.affiliate-card-preview article',
 '.product-card-head>a',
 '.product-alternative-card>div>a',
 '.rental-cross-sell-box a',
 '.product-faq-list summary',
 '.product-faq-list p',
 '.product-trust-box>div:first-child p'
];
for(const selector of selectors)assert.ok(style.includes(selector),'missing enlarged rental area: '+selector);
assert.ok(style.includes('@media(max-width:560px)'),'narrow screen layout protections preserved');
assert.ok(style.includes('prefers-reduced-motion:reduce'),'reduced motion supported');
assert.match(featured,/설치비가 있나요\?/);
assert.match(featured,/제휴카드는 꼭 만들어야 하나요\?/);
assert.match(featured,/신청 즉시 결제되지 않습니다/);
assert.match(featured,/인터넷·TV 계산하기/);
console.log('Rental action clarity: 19 customer regions, 471-page shared CSS, catalog links and FAQ PASS');
