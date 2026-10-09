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
console.log('Homepage text clarity: red-marked labels, bold typography, mobile wrap, CSS load order PASS');
