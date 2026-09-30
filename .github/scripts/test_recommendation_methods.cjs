const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

class Element {
  constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.events={};this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};}
  append(...children){this.children.push(...children);}
  appendChild(child){this.append(child);}
  replaceChildren(...children){this.children=children;}
  setAttribute(name,value){this.attributes[name]=value;}
  addEventListener(name,fn){this.events[name]=fn;}
  click(){if(!this.disabled)this.events.click?.();}
}
const source=fs.readFileSync('assets/recommendation-engine-v2.js','utf8');
const snippets=['addKV','consultText','detailUrl','card','categoryLabel'].map(name=>{
  const start=source.indexOf('  function '+name+'(');
  assert.ok(start>=0,name);
  const end=source.indexOf('\n  function ',start+1);
  return source.slice(start,end===-1?undefined:end);
});
let consultation;
const ctx={document:{createElement:tag=>new Element(tag)},window:{WoongbiPlanEligibility:{labels:()=>[]},WoongbiQuoteHandoff:{open:text=>{consultation=text;}}},URL,location:{origin:'https://woongbts.github.io'},state:{methods:new Map()},deviceImage:()=>'',comboReason:()=>['사용 편의'],won:value=>Math.round(value).toLocaleString('ko-KR')+'원'};
vm.createContext(ctx);vm.runInContext(snippets.join('\n'),ctx);
const all=(el,predicate)=>[...(predicate(el)?[el]:[]),...el.children.flatMap(child=>all(child,predicate))];
const quote=(method,monthly,service,welfareAmount=0)=>({method,monthly,total24:monthly*24,service,inst:{monthly:monthly-service},support:206000,contractDiscount:8250,welfareAmount});
const support=quote('support',34399,33000),contract=quote('contract',35270,24750);
const combo={d:{id:'device',name:'스타일폴더2',carrier:'LGU+'},p:{id:'plan',name:'데이터플랜1.5GB',monthly_fee:33000,data:'1.5GB',voice:'무제한',sms:'기본 제공'},join:'번호이동',welfare:'none',lane:'월 부담 우선',support,contract,best:support};
const card=ctx.card(combo,'senior');
const compare=all(card,el=>el.className==='wb-v2-compare')[0];
const amount=all(card,el=>el.className==='purpose-card-total')[0].children[1];
const details=all(card,el=>el.tagName==='details')[0];
details.open=true;
assert.equal(compare.children[0].attributes['aria-pressed'],'true');
compare.children[1].click();
assert.equal(card.dataset.selectedMethod,'contract');
assert.equal(amount.textContent,'35,270원');
assert.equal(details.open,true,'method selection must keep the card expanded');
assert.equal(compare.children[0].attributes['aria-pressed'],'false');
assert.equal(compare.children[1].attributes['aria-pressed'],'true');
const detailRows=all(card,el=>el.className==='purpose-card-detail')[0].children;
assert.ok(detailRows.some(row=>row.children[0].textContent==='선택약정 월 할인'));
assert.ok(!detailRows.some(row=>row.children[0].textContent==='적용 공시지원금'));
const actions=all(card,el=>el.className==='purpose-card-actions')[0];
actions.children[1].click();
assert.match(consultation,/선택한 할인방식: 선택약정 25%/);
assert.match(consultation,/예상 월 납부액: 35,270원/);
assert.match(consultation,/m=contract/);
assert.doesNotMatch(consultation,/적용 공시지원금:/);
actions.children[0].click();
assert.equal(new URL(ctx.location.href).searchParams.get('m'),'contract');
compare.children[0].click();
assert.equal(amount.textContent,'34,399원');
actions.children[1].click();
assert.match(consultation,/선택한 할인방식: 공시지원금/);
assert.match(consultation,/m=support/);
assert.equal(combo.best,support,'selection must not mutate the engine recommendation');
compare.children[1].click();
assert.equal(ctx.card(combo,'senior').dataset.selectedMethod,'contract','selection survives a redraw');
const unknown=ctx.card({...combo,d:{...combo.d,id:'unknown'},support:null,best:contract},'senior');
assert.equal(all(unknown,el=>el.className==='wb-v2-compare')[0].children[0].disabled,true);
console.log('Recommendation method switching: price, itemization, expanded state, consultation and detail URL passed.');
