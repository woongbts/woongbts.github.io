'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('rental/index.html','utf8');
const css=fs.readFileSync('rental/assets/readability-20261009.css','utf8');
assert.match(html,/readability-20261009\.css\?v=20261009-1/,'new large-text stylesheet is loaded');
assert.ok(html.indexOf('readability-20261009.css')>html.indexOf('ai-recommend.css'),'accessibility styles override older small-type rules');
assert.match(html,/사장님이 직접 확인하고 안내합니다\./);
assert.doesNotMatch(html,/웅비통신 덕천만덕점이 직접 확인하고 안내합니다/);
assert.match(html,/href="product\/cp-aqs100ewh\/"[^>]*>이 상품 상세 조건 보기/);
assert.ok(fs.existsSync('rental/product/cp-aqs100ewh/index.html'),'featured product resolves to a real detail page');
assert.doesNotMatch(html,/샘플 상세페이지 보기/);
const groupSelectors=[
 '.hero-copy .hero-points li',
 '.ai-recommend-banner .ai-recommend-copy p:last-child',
 '.recommend-sort>span',
 '.appliance-grid .appliance-category>small',
 '.catalog-open-row>span',
 '.benefit-note>p',
 '.rental-guide-grid>a>small',
 '.rental-card-guide-box>div>p:last-child',
 '.rental-card-guide-box>a',
 '.rental-trust-box>div:first-child>p:last-child',
 '.rental-trust-steps small',
 '.ai-recommend-head>div>small',
 '.ai-step-progress>span',
 '.ai-empty.ai-empty-start>strong',
 '.ai-empty.ai-empty-start>p'
];
for (const selector of groupSelectors) assert.ok(css.includes(selector), 'missing customer readability rule: '+selector);
assert.match(css,/\.ai-recommend-head>div>small\{[^}]*font-size:16px!important/s,'previously tiny AI helper now at readable desktop size');
assert.match(css,/\.ai-step-progress>span\{[^}]*font-size:16px!important/s,'AI recommendation step captions enlarged');
assert.match(css,/\.ai-empty\.ai-empty-start>strong\{[^}]*font-size:20px!important/s,'AI empty headline enlarged');
assert.match(css,/@media\(max-width:560px\)/,'responsive mobile sizes defined');
assert.match(css,/\.appliance-grid \.appliance-category\{[^}]*height:auto!important/s,'mobile category cards can grow with text');
console.log('Rental readability: all marked captions enlarged, genuine product detail link, owner wording, mobile cards verified.');
