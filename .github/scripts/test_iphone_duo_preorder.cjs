'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const home=fs.readFileSync('index.html','utf8');
const landing=fs.readFileSync('iphone-duo/index.html','utf8');
const calculator=fs.readFileSync('rates.html','utf8');

// The Duo preorder ended; links, preorder forms and reservation marketing
// must not be resurrected by a later homepage or calculator change.
assert.doesNotMatch(home,/iphone18-promo|iphone-duo|duo-name|duo-inquiry/,'ended preorder removed from homepage');
assert.doesNotMatch(calculator,/iphone-duo\/|duo-preorder/,'ended preorder removed from calculator');
assert.match(landing,/name="robots" content="noindex,follow"/,'retired landing should not be indexed');
assert.match(landing,/http-equiv="refresh"[^>]+url=https:\/\/woongbts\.github\.io\//,'retired landing redirects to home');
assert.match(landing,/이전 안내 페이지는 운영을 종료했습니다/,'retirement explanation is visible');
assert.doesNotMatch(landing,/duo-name|duo-form|duo-inquiry/,'no collection of outdated preorder requests');
console.log('Ended iPhone Duo preorder: homepage removal and safe landing redirect passed.');
