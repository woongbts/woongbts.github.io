'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('rental/assets/product-generic.js','utf8');
const start=source.indexOf('  function currentProductSectionUrl('),end=source.indexOf('  function totalRentEstimate(',start);
assert.ok(start>=0&&end>start);
for(const href of [
 'https://woongbts.github.io/rental/product/chp-7220n/',
 'https://woongbts.github.io/rental/product/cp-aqs100ewh/?mgmt=self&term=60',
 'https://woongbts.github.io/rental/product.html?id=chp-7220n&term=84#old',
 'http://127.0.0.1:8772/rental/product/chp-7220n/'
]){
 const context={URL,location:{href}};vm.createContext(context);vm.runInContext(source.slice(start,end),context);
 const actual=context.currentProductSectionUrl('generic-source-detail');
 const expected=new URL(href);expected.hash='generic-source-detail';
 assert.equal(new URL(actual,'https://woongbts.github.io/rental/').href,expected.href);
 assert.equal(new URL(actual).pathname,new URL(href).pathname,'stay on the same product despite asset base');
 assert.equal(new URL(actual).search,new URL(href).search,'preserve selected option query');
}
assert.ok(source.includes("jump.href = currentProductSectionUrl('generic-source-detail')"));
console.log('Rental detail jump stays on clean/legacy product routes, preserves options and ignores asset base PASS');
