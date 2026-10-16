'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const page=fs.readFileSync('rental/cards/index.html','utf8');
const css=fs.readFileSync('rental/assets/cards.css','utf8');
const js=fs.readFileSync('rental/assets/cards.js','utf8');
const payload=JSON.parse(fs.readFileSync('rental/data/affiliate-cards.json','utf8'));
const vm=require('node:vm');
const basicMaximum=vm.runInNewContext('('+js.match(/function maxDiscount\(card\)\{[^\n]+\}/)[0]+')');
assert.equal(basicMaximum({tiers:[{discount:7000},{discount:13000}],maxDiscount:24000}),13000,'basic maximum must not include promotional maximum');
assert.ok(page.includes('assets/cards.css?v=20261016-artwork1'),'customer page must load latest typography');
assert.ok(page.includes('cards.js?v=20261016-artwork1'),'customer page must load current card renderer');
assert.equal(payload.providers.reduce((sum,p)=>sum+p.cards.length,0),21,'card dataset available');
for(const provider of payload.providers)for(const card of provider.cards){
 assert.ok(card.image?.startsWith('assets/cards/'),'each card has its own local artwork: '+card.name);
 assert.ok(fs.statSync('rental/'+card.image).size>1000,'card image is saved: '+card.name);
 assert.ok(card.imageSourceUrl&&card.imageSourcePage,'card artwork keeps its source: '+card.name);
}
const hana=payload.providers.find(p=>p.id==='coway').cards.find(c=>c.issuer==='하나카드');
assert.ok(hana.autopayRequired&&hana.exclusions&&hana.firstMonthRule&&hana.cautions.length>=3,'Hana missing eligibility and billing conditions are populated');
assert.deepEqual(hana.tiers.map(t=>t.discount),[13000,18000,25000],'Hana basic discount tiers match official product');
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
