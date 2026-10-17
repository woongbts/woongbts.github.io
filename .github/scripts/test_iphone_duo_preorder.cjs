const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('assets/iphone-duo-preorder.js','utf8');
const home=fs.readFileSync('index.html','utf8');
const page=fs.readFileSync('iphone-duo/index.html','utf8');
for(const html of [home,page]){
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(ids.length,new Set(ids).size,'no duplicate IDs');
 for(const id of ['duo-name','duo-phone','duo-carrier','duo-model','duo-color','duo-inquiry','duo-consent'])assert.ok(ids.includes(id),id);
 assert.match(html,/preload="none"/,'video does not delay page load');
 assert.doesNotMatch(html,/\bautoplay\b/,'no unsolicited playback');
}
assert.match(home,/id="iphone18-promo" class="duo-section"/,'legacy iPhone 18 injection is replaced');
assert.match(page,/<h1 id="duo-title">iPhone Duo/);
assert.doesNotMatch(source,/localStorage|sessionStorage/,'no personal data browser storage');
const context={window:{},document:{readyState:'loading',addEventListener(){}},Date,URLSearchParams};
vm.createContext(context);vm.runInContext(source,context);
// All links must open the *selected* Duo model/volume in the existing live calculator.
assert.match(page, /id="duo-calc-carrier"/,'Duo calculator carrier picker exists');
const landingLinks=[...page.matchAll(/data-duo-calc="([^"]+)"/g)].map(m=>m[1]);
assert.deepEqual(landingLinks,['256GB','256GB','512GB','1TB'],'hero and every capacity have calculator links');
assert.match(page,/아이폰 듀오 요금 계산하기/,'prominent calculator CTA is present');
const makeUrl=context.window.WoongbiDuoPreorder.buildCalculatorUrl;
assert.match(page,/<option value="SKT">SKT<\/option>/,'SKT selectable on landing');
for(const [carrier,plan,ids] of [
  ['SKT','SKT-XP-969',{'256GB':'SKT-XD-3053','512GB':'SKT-XD-3056','1TB':'SKT-XD-3059'}],
  ['KT','KT-XP-2605',{'256GB':'KT-XD-3054','512GB':'KT-XD-3057','1TB':'KT-XD-3060'}],
  ['LGU+','LG-XP-2512',{'256GB':'LG-XD-3055','512GB':'LG-XD-3058','1TB':'LG-XD-3061'}]
]){
  for(const [capacity,device] of Object.entries(ids)){
    const url=new URL('https://woongbts.github.io'+makeUrl(carrier,capacity));
    assert.equal(url.pathname,'/rates.html');
    for(const [key,val] of Object.entries({tab:'mobile',mode:'direct',brand:'apple',c:carrier,
      j:'번호이동',d:device,p:plan,m:'contract',mo:'24',w:'none'}))
      assert.equal(url.searchParams.get(key),val,carrier+' '+capacity+' '+key);
  }
}

assert.throws(()=>makeUrl('KT','2TB'),'preorder page only advertises 256GB, 512GB and 1TB');
const initialHref=page.match(/data-duo-calc="256GB" href="([^"]+)"/)?.[1];
assert.ok(initialHref?.includes('KT-XD-3054'),'calculator remains functional before JS hydration');
{
 let boot,changed;
 const nodes={'duo-calc-carrier':{value:'KT',addEventListener:(type,callback)=>{if(type==='change')changed=callback}}};
 const cards=['256GB','512GB','1TB'].map(capacity=>({dataset:{duoCalc:capacity},setAttribute(){}}));
 const doc={readyState:'loading',addEventListener:(name,cb)=>{if(name==='DOMContentLoaded')boot=cb},
   getElementById:id=>nodes[id]||null,
   querySelectorAll:selector=>selector==='[data-duo-calc]'?cards:[]};
 const ctx={window:{},document:doc,Date,URLSearchParams};
 vm.createContext(ctx);vm.runInContext(source,ctx);boot();
 assert.ok(cards[2].href.includes('KT-XD-3060'));
 nodes['duo-calc-carrier'].value='SKT';changed();
 assert.ok(cards[0].href.includes('SKT-XD-3053'));
 assert.ok(cards[1].href.includes('SKT-XD-3056'));
 assert.ok(cards[2].href.includes('SKT-XD-3059'));
 nodes['duo-calc-carrier'].value='LGU+';changed();
 assert.ok(cards[0].href.includes('LG-XD-3055'));
 assert.ok(cards[1].href.includes('LG-XD-3058'));
 assert.ok(cards[2].href.includes('LG-XD-3061'));
}
const build=context.window.WoongbiDuoPreorder.buildPayload;
const values={name:'검수테스트',phone:'010-0000-0000',carrier:'KT',model:'512GB',color:'나이트 스카이',inquiry:'평일 오후 연락 희망',consent:'on'};
const payload=build(values,'POLICY-TEST');
assert.equal(payload.phone,'01000000000');assert.equal(payload.provider,'KT');
assert.match(payload.product_name,/512GB.*나이트 스카이/);
assert.match(payload.detail,/희망 통신사: KT/);assert.equal(payload.inquiry,values.inquiry);
assert.equal(payload.processing_consent,true);assert.equal(payload.category,'mobile');
for(const override of [{phone:'123'},{carrier:'INVALID'},{model:'2TB'},{color:'INVALID'},{consent:''},{inquiry:'1234567890123456'}])assert.throws(()=>build({...values,...override},'POLICY-TEST'));
assert.throws(()=>build(values,''),'missing policy blocks submission');

async function submitFlow(succeeds){
 let boot,now=Date.parse('2026-10-16T12:00:00+09:00'),sent;
 const nodes=new Map();
 function element(id){if(!nodes.has(id))nodes.set(id,{id,value:'',hidden:false,textContent:'',listeners:{},addEventListener(t,f){this.listeners[t]=f},reset(){},replaceChildren(){},append(){},showModal(){this.open=true},close(){this.open=false},focus(){}});return nodes.get(id);}
 element('duo-success').hidden=true;
 const opener=element('opener');
 const policy={version:'POLICY-TEST',operator:'웅비통신',purpose:'상담',items:{required:'이름, 연락처'},retention:'90일'};
 const ctx={window:{},location:{origin:'https://woongbts.github.io',pathname:'/iphone-duo/'},Date:class extends Date{static now(){return now}},
  FormData:class{*[Symbol.iterator](){yield*Object.entries(values)}},
  document:{readyState:'loading',getElementById:element,querySelectorAll:s=>s==='[data-duo-open]'?[opener]:[],addEventListener:(t,f)=>{boot=f},createElement:()=>element('policy-row')},
  fetch:async(url,options)=>{
   if(url.endsWith('-policy'))return {ok:true,json:async()=>({ok:true,policy})};
   sent=JSON.parse(options.body);return {ok:succeeds,json:async()=>succeeds?{ok:true,receipt:{id:'TEST-ONLY',lookup_token:'TEST-TOKEN'}}:{ok:false,error:'검수용 접수 실패'}};
  }};
 vm.createContext(ctx);vm.runInContext(source,ctx);boot();
 opener.listeners.click();await new Promise(resolve=>setImmediate(resolve));now+=1000;
 await element('duo-form').listeners.submit({preventDefault(){}});
 assert.equal(sent.color,undefined); // All selection fields use existing CRM product/detail fields.
 assert.equal(sent.page_url,'https://woongbts.github.io/iphone-duo/');
 assert.match(sent.detail,/KT.*512GB.*나이트 스카이/);
 assert.equal(element('duo-success').hidden,!succeeds);
 if(succeeds){assert.equal(element('duo-form').hidden,true);assert.match(element('duo-status-link').href,/TEST-TOKEN/);}
 else{assert.match(element('duo-form-status').textContent,/검수용 접수 실패/);assert.equal(element('duo-form').hidden,false);}
}
(async()=>{await submitFlow(true);await submitFlow(false);console.log('Duo preorder fields, privacy validation, CRM payload, success and failure flows passed.');})().catch(e=>{console.error(e);process.exitCode=1});
