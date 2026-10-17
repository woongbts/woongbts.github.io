'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('rental/assets/product-generic.js','utf8');
const ctx={Date};vm.createContext(ctx);
vm.runInContext(source.slice(source.indexOf('  function cardDiscountedMonthly('),source.indexOf('  function cardDetailHtml(')),ctx);
const sample={name:'test',tiers:[{spend:300000,discount:13000},{spend:800000,discount:18000}],promo:{period:'2026-10-01 ~ 2026-10-31',duration:'최대 60회',tiers:[{spend:300000,discount:21000}]}};
const calc=(card,key,monthly,confirmed=true,month=1,date='2026-10-17')=>ctx.rentalCardEstimate(card,key,monthly,confirmed,month,date);
assert.equal(calc(sample,'basic-0',28900).after,15900);
assert.equal(calc(sample,'basic-1',28900).after,10900);
assert.equal(calc(sample,'basic-0',35900).after,22900,'selected tier reprices against changed rental option');
assert.equal(calc(sample,'promo-0',28900).after,7900);
assert.equal(calc(sample,'promo-0',28900,true,61).available,false,'promotion cannot continue beyond its duration');
assert.equal(calc(sample,'promo-0',28900,true,1,'2026-11-01').available,false,'expired issue promotions are unavailable');
assert.equal(calc(sample,'promo-0',28900,true,1,'2026-09-30').available,false);
assert.equal(calc({...sample,promo:{...sample.promo,period:'현재 진행 여부 확인'}},'promo-0',28900).available,false,'unknown dates are not silently active');
assert.equal(calc(sample,'basic-0',28900,false).available,false,'no automatic conditional discount');
assert.equal(calc(null,'basic-0',28900).available,false,'no card means no assumed discount');
assert.equal(calc(sample,'basic-0',null).available,false,'missing rental fee must not become zero');
assert.equal(calc(sample,'basic-0',10000).discount,10000,'discount cannot exceed billed rent');
assert.equal(calc(sample,'basic-0',10000).after,0);
const data=JSON.parse(fs.readFileSync('rental/data/affiliate-cards.json','utf8'));
for(const provider of data.providers)for(const card of provider.cards){
 assert.ok(ctx.rentalCardTiers(card,'2026-10-17').some(t=>!t.promo),card.name+' has selectable basic benefits');
}
for(const file of ['rental/product.html','rental/product/chp-7220n/index.html']){
 const html=fs.readFileSync(file,'utf8');
 for(const id of ['rental-card-select','rental-card-tier','rental-card-confirmed','rental-card-status'])assert.ok(html.includes('id="'+id+'"'));
 assert.ok(html.includes('product-generic.js?v=20261017-card-picker1'));
}
console.log('Rental card calculator: basic/promo tiers, eligibility, period, caps, option repricing and generated routes PASS');
