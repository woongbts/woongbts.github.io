'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('assets/home-bold-readability-20261009.css','utf8');
const quick=fs.readFileSync('assets/quick-order.js','utf8');
const injected=fs.readFileSync('assets/site-pro.min.js','utf8');
assert.match(html,/home-bold-readability-20261009\.css\?v=20261009-b1/);
assert.ok(html.indexOf('home-bold-readability-20261009.css')>html.indexOf('quick-order.css'),'bold typography must load last');
assert.match(html,/class="home-order-category-grid"/);
assert.match(html,/class="owner-note"/);
assert.match(html,/class="principle-grid"/);
assert.match(html,/class="home-trust-rail"/);
assert.match(html,/class="access-badge"/);
assert.match(injected,/storefront-head/);
assert.match(quick,/home-order-option/);
for(const selector of [
  '.home-order-kicker','.home-order-category small','.home-order-choice-heading small',
  '.home-order-option small','.home-order-disclaimer','.home-order-detail-link',
  '.hero .intro','.hero-microcopy','.home-trust-rail span',
  '#woongbi-storefront-deals .storefront-head>div>p:not(.eyebrow)',
  '.service-card>p','.service-links a','.owner-note>p',
  '.principle h3','.principle p','#location .section-note',
  '#location .details dt','#location .details dd',
]){
 assert.ok(css.includes(selector),'missing bold readable styles for '+selector);
}
assert.match(css,/font-weight:750!important/);
assert.match(css,/font-weight:850!important/);
assert.match(css,/@media\(max-width:600px\)/);
assert.match(css,/@media\(max-width:360px\)/);
assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.doesNotMatch(css,/@import\s+/i,'no external font download needed');
const actions=fs.readFileSync('assets/home-link-button-nav-20261009.css','utf8');
const dynamic=fs.readFileSync('assets/site-pro.min.js','utf8');
assert.ok(html.includes('home-link-button-nav-20261009.css?v=20261009-color3'));
assert.ok(html.includes('site-pro.min.js?v=20261009-linkbtn1'));
assert.ok(dynamic.includes("className='storefront-fallback-link'"));
assert.ok(dynamic.includes('class="storefront-all"'));
for(const key of [
 '#woongbi-storefront-deals .storefront-head .storefront-all',
 '#woongbi-storefront-deals .deal-grid a.storefront-fallback-link',
 '#wb-rate-entry .wb-rate-entry-copy p',
 '#wb-rate-entry .wb-rate-entry-link',
 '.top .menu a',
 '@media(max-width:640px)',
 'font-weight:850!important',
 'font-size:18px!important',
]) assert.ok(actions.includes(key),'missing enlarged action style '+key);
assert.ok(actions.includes('background:#0d766a!important'),'recommendation calculator button filled teal');
assert.ok(actions.includes('background:#125884!important'),'catalog button filled blue');
assert.ok(actions.includes('color:#fff!important'),'button text remains white and readable');
console.log('Homepage CTA links and navigation: large button styles, dynamic fallback and mobile layout PASS');

const colors=fs.readFileSync('assets/home-colored-actions-20261009.css','utf8');
const picker=fs.readFileSync('assets/quick-order.js','utf8');
assert.ok(html.includes('home-colored-actions-20261009.css?v=20261009-b1'),'new 6-category palette loaded');
assert.ok(html.includes('quick-order.js?v=20261009-b1'),'category state JS cache refreshed');
assert.ok(picker.includes('root.dataset.activeCategory=category;'),'UI state exposed for context color');
const categories=['mobile','mvno','prepaid','internet','rental','visit'];
for(const cat of categories)assert.ok(colors.includes('[data-quick-category="'+cat+'"]'),cat+' has own palette');
for(const purpose of ['senior','kids','value','premium'])assert.ok(colors.includes('[href*="purpose='+purpose+'"]'),purpose+' has own distinct button');
for(const service of ['service-mvno','service-internet','service-card-rental'])assert.ok(colors.includes(service),service+' action link colors defined');
assert.ok(colors.includes('.service-card .service-links a.main-link'),'main consultation action is filled and readable');
assert.ok(colors.includes('.service-card .service-links a:focus-visible'),'keyboard access is visible');
assert.ok(colors.includes('@media(max-width:760px)'),'compact colored card variants exist');
console.log('Color categories, four phone choices and consultation action selectors PASS');
console.log('Homepage text clarity: red-marked labels, bold typography, mobile wrap, CSS load order PASS');
