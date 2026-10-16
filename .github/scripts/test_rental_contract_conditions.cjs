'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const js=fs.readFileSync('rental/assets/product-generic.js','utf8');
const data=JSON.parse(fs.readFileSync('rental/data/contract-conditions.json','utf8'));
const helpers=js.slice(js.indexOf('  function contractValue('),js.indexOf('  function renderContractSummary('));
const context={product:{contractConditions:data.products['chp-7220n']},variant:{term:36},currentVariant(){return this.variant;}};
// Provide the selected option without involving network requests or an application form.
context.currentVariant=()=>context.variant;
vm.createContext(context);vm.runInContext(helpers,context);
assert.equal(context.mandatoryTermLabel(),'36개월');
context.variant.term=60;assert.equal(context.mandatoryTermLabel(),'60개월');
context.variant.term=84;assert.equal(context.mandatoryTermLabel(),'의무사용 36/60/72개월');
assert.equal(context.ownershipLabel(),'계약기간(60/72개월) 만료 후 소유권 이전');
context.product={contractConditions:{mandatoryText:'의무사용 36개월',mandatoryTerms:[36],ownershipText:'60개월 소유권 이전'}};
assert.equal(context.mandatoryTermLabel(),'36개월','a longer rental contract must not extend a fixed minimum term');
assert.equal(context.ownershipLabel(),'60개월 소유권 이전','minimum use and ownership remain distinct');
context.product={contractConditions:{mandatoryText:'의무사용 36개월 청약 시 60개월 소유권 이전',mandatoryTerms:[]}};
assert.equal(context.mandatoryTermLabel(),context.product.contractConditions.mandatoryText,'ambiguous compound source stays verbatim');
context.product={};assert.equal(context.mandatoryTermLabel(),'상담 확인');assert.equal(context.ownershipLabel(),'상담 확인');
for(const item of Object.values(data.products)){
 assert.match(item.sourceUrl,/^http:\/\/woongbi\.vip-rental\.com\/categ\/\d+\/\d+$/);
 assert.ok(item.rawConditions.includes(item.mandatoryText)&&item.rawConditions.includes(item.ownershipText));
 if(/소유권|청약|년/.test(item.mandatoryText))assert.equal(item.mandatoryTerms.length,0,'compound conditions must not be converted to a period list');
}
console.log('Rental contract conditions: exact option match, fixed minimum, unmatched 84 months and verbatim ownership PASS ('+Object.keys(data.products).length+' products)');
