'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {estimate}=require('../../assets/mobile-cards.js');
const data=JSON.parse(fs.readFileSync('data/mobile-affiliate-cards.json','utf8'));
const quote={known:true,monthly:60000,service:33000};
const options={confirmed:true,month:1,today:'2026-10-17'};
// Model fixtures stay independent of current card IDs, removals and live policy amounts.
const fixtureCards=[
 {id:'154',category:'POST',calculation:'fixed',checkedAt:'2026-10-17',promotion:'new-card promotion',promotionDeadline:'2026-10-31',promotionMonths:24,tiers:[{id:'a',minSpend:400000,amount:8000,verified:true},{id:'p',minSpend:400000,amount:28000,promotion:true,verified:true}]},
 {id:'80',category:'POST',calculation:'family-percent',tiers:[{id:'a',minSpend:300000,amount:17000,verified:true}]},
 {id:'126',category:'POST',calculation:'kbank-percent',tiers:[{id:'a',minSpend:200000,amount:5000,rate:.05,minBill:100000,verified:true}]},
 {id:'391',category:'POST',calculation:'ibk-percent',tiers:[{id:'a',minSpend:1000000,amount:50000,verified:true}]},
 {id:'376',category:'PRE',calculation:'fixed',tiers:[{id:'a',minSpend:800000,amount:25000,verified:true}]},
 {id:'186',category:'POST',calculation:'fixed',basicMonths:36,tiers:[{id:'a',minSpend:1000000,amount:22000,verified:true}]},
 {id:'243',category:'POST',calculation:'fixed',tiers:[{id:'a',minSpend:200000,amount:10000,verified:false}]}
];
const card=id=>fixtureCards.find(c=>c.id===id);
const basic=id=>card(id).tiers.find(t=>!t.promotion&&t.verified);
for(const carrier of ['SKT','KT','LGU+']){
 const rows=data.cards.filter(c=>c.carrier===carrier);
 assert.equal(rows.length,data.counts[carrier]);assert.ok(rows.length>0);
 for(const type of ['POST','PRE'])assert.ok(rows.some(c=>c.category===type));
 for(const c of rows){assert.ok(c.benefit&&c.conditions&&c.sourceUrl&&c.image);assert.ok(fs.statSync(c.image).size>1000)}
}
assert.equal(new Set(data.cards.map(c=>c.id)).size,data.cards.length);
assert.equal(estimate(card('154'),basic('154'),quote,options).after,52000);
assert.equal(estimate(card('154'),basic('154'),quote,{...options,confirmed:false}).available,false);
assert.equal(estimate(card('154'),basic('154'),{...quote,known:false},options).available,false);
assert.equal(estimate(card('154'),basic('154'),{known:true,monthly:null,service:null},options).available,false);
assert.equal(estimate(card('154'),basic('154'),{known:true,monthly:1000,service:500},options).discount,500);
assert.equal(estimate(card('80'),basic('80'),quote,options).discount,8250,'percentage cap is not the discount');
assert.equal(estimate(card('80'),basic('80'),quote,{...options,month:25}).discount,4950);
assert.equal(estimate(card('126'),basic('126'),quote,options).available,false,'minimum telecom bill must hold');
assert.equal(estimate(card('391'),basic('391'),quote,options).discount,1650,'IBK 5 percent, not its 50000 cap');
assert.equal(estimate(card('376'),basic('376'),quote,options).available,false,'card financing must not be subtracted from carrier financing');
assert.equal(estimate(card('186'),basic('186'),quote,{...options,month:37}).available,false,'limited term cannot be extrapolated forever');
const promo=card('154').tiers.find(t=>t.promotion);
assert.equal(estimate(card('154'),promo,quote,options).discount,28000,'eligible promotion has its own amount');
assert.equal(estimate(card('126'),basic('126'),{known:true,monthly:130000,service:100000},options).discount,5000,'cashback percentage uses actual telecom bill');
assert.equal(estimate(card('154'),promo,quote,{...options,today:'2099-12-01'}).available,false,'stale promotions must stop');
assert.equal(estimate(card('154'),promo,quote,{...options,month:25}).available,false,'promotion term matters');
assert.equal(estimate(card('243'),card('243').tiers.find(t=>t.minSpend===200000),quote,options).available,false,'conflicting source row cannot become a discount');
const html=fs.readFileSync('rates.html','utf8'),source=fs.readFileSync('src/rates.js','utf8');
assert.ok(html.includes('mobile-card-title')&&html.includes('mobile-cards.js?v=20261017-cards2'));
assert.ok(source.includes('WoongbiMobileCards?.quoteLines')&&source.includes('WoongbiMobileCards?.appendUrl'),'card scenario survives copy and share');
console.log('Telecom cards: three carriers, '+data.cards.length+' card variants, images, caps, percentage rules, eligibility, expiry, financing separation and quote handoff PASS');
// Reproduce a cold shared link: card JSON arrives before core device/plan data.
async function testColdSharedLink(){
 const vm=require('node:vm'),fields={},events={};
 function field(id){return fields[id]||=( {id,value:'',textContent:'',hidden:false,checked:false,
  addEventListener(){},replaceChildren(...options){this.options=options;this.value=options[0]?.value||''}} )}
 const selected=data.cards.find(c=>c.carrier==='KT'&&c.category==='POST'&&c.tiers.some(t=>!t.promotion&&t.verified));
 const tier=selected.tiers.find(t=>!t.promotion&&t.verified);
 const url=new URL('https://woongbts.github.io/rates.html?c=KT&d=device&p=plan');
 for(const [key,value] of Object.entries({ccard:selected.id,ctier:tier.id,cmonth:'1',celigible:'1'}))url.searchParams.set(key,value);
 field('carrier').value='SKT';field('mobile-card-type').value='POST';field('monthly-total').textContent='—';
 let current=null;
 const window={addEventListener:(name,fn)=>events[name]=fn,WoongbiQuoteApi:{getCurrent:()=>current}};
 const ctx={window,URL,URLSearchParams,console,Date,Option:function(text,value){this.text=text;this.value=value},
  document:{getElementById:field,documentElement:{dataset:{quoteApi:'ready'}}},
  location:{search:url.search,href:url.href},history:{replaceState(){}},
  fetch:async()=>({ok:true,json:async()=>data})};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('assets/mobile-cards.js','utf8'),ctx);
 await new Promise(setImmediate);
 assert.equal(field('mobile-card-select').value,'','must wait for the core carrier');
 assert.equal(window.WoongbiMobileCards.appendUrl(new URL(url)).searchParams.get('ccard'),selected.id,'pending card URL must survive core URL updates');
 field('carrier').value='KT';field('device-select').value='device';field('plan-select').value='plan';
 field('monthly-total').textContent='60,000원';current=quote;events['woongbi:quote-ready']();
 assert.equal(field('mobile-card-select').value,selected.id);
 assert.equal(field('mobile-card-tier').value,tier.id);
 assert.equal(field('mobile-card-confirmed').checked,true);
 assert.ok(window.WoongbiMobileCards.quoteLines().some(line=>line.includes(selected.name)));
 console.log('Cold shared-card link restores after independent calculator loading PASS');
}
testColdSharedLink().catch(error=>{console.error(error);process.exitCode=1});
