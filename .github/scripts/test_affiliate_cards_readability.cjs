'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const page=fs.readFileSync('rental/cards/index.html','utf8');
const css=fs.readFileSync('rental/assets/cards.css','utf8');
const js=fs.readFileSync('rental/assets/cards.js','utf8');
const payload=JSON.parse(fs.readFileSync('rental/data/affiliate-cards.json','utf8'));
assert.ok(page.includes('assets/cards.css?v=20261009-readable5'),'customer page must load latest typography');
assert.ok(page.includes('cards.js?v=20261009-amount2'),'functional card comparison code unchanged');
assert.equal(payload.providers.reduce((sum,p)=>sum+p.cards.length,0),21,'card dataset available');
assert.ok(js.includes('data-provider')&&js.includes('renderCards()'),'provider selector remains functional');
assert.ok(js.includes('class="card-tier"')&&js.includes('class="card-max"'),'discount and spending data remain displayed');
assert.ok(js.includes('class="card-max-amount"'),'highlighted monthly maximum uses existing amount calculation');
assert.ok(css.includes('.card-max .card-max-amount'),'large discount amount is distinctly styled');
const selectors=[
 '.card-hero .wrap>p:not(.eyebrow)',
 '.card-provider-tabs button',
 '.affiliate-card h3',
 '.affiliate-card .annual',
 '.affiliate-card .promo',
 '.affiliate-card .card-tier span',
 '.affiliate-card .card-tier strong',
 '.affiliate-card .card-max',
 '.affiliate-card .card-detail summary',
 '.affiliate-card .card-detail dd',
 '.affiliate-card .card-detail .card-verified',
 '.card-notice strong',
 '.card-notice p',
 '.footer-note',
];
for(const selector of selectors) assert.ok(css.includes(selector),'missing readable card region: '+selector);
assert.ok(css.includes('font-size:19px!important'),'max monthly discount prominently sized');
assert.ok(css.includes('color:#076354!important'),'savings visibly highlighted');
assert.ok(css.includes('font-weight:950!important'),'savings shown in bold');
assert.ok(css.includes('@media(max-width:560px)'),'mobile type adapted');
assert.ok(css.includes('@media(max-width:350px)'),'compact narrow button/text wrap accounted for');
assert.ok(css.includes('.card-detail summary:focus-visible'),'keyboard focus stays visible');
console.log('Affiliate cards: 21 cards and 14 legibility regions, accent colors and mobile styles PASS');
