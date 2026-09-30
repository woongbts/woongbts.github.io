const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
class Element {
  constructor() { this.children=[];this.events={};this.classList={add(){},remove(){}};this.isConnected=true; }
  append(...items) {this.children.push(...items);}
  setAttribute() {}
  addEventListener(k,f) {this.events[k]=f;}
  focus() {}
  select() {this.selected=true;}
  showModal() {this.open=true;}
  close() {this.open=false;this.events.close?.();}
  remove() {this.isConnected=false;}
  querySelector(key) {return (this.selectors ||= {})[key] ||= new Element();}
}
const flush=()=>new Promise(r=>setImmediate(r));
async function quote(fails) {
  const body=new Element();
  const context={window:{},document:{body,activeElement:new Element(),getElementById:()=>null,createElement:()=>new Element()},navigator:{clipboard:{writeText:async()=>{if(fails)throw Error('denied');}}}};
  vm.runInNewContext(fs.readFileSync('assets/quote-handoff.js','utf8'),context);
  context.window.WoongbiQuoteHandoff.open('공개 테스트 견적');await flush();
  const dialog=body.children[0],status=dialog.querySelector('[role="status"]');
  assert.match(status.textContent,fails?/자동 복사가 되지 않았습니다/:/견적을 복사했습니다/);
  assert.equal(dialog.querySelector('textarea').value,'공개 테스트 견적');
  if(fails)assert.equal(dialog.querySelector('textarea').selected,true);
  dialog.close();assert.equal(dialog.isConnected,false);
}
async function popup(hide=false,seen=false,dismissed=false) {
  const body=new Element(),local=new Map(),session=new Map();
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if(hide)local.set('woongbi-support-hide',today);
  if(dismissed)local.set('woongbi-support-dismissed','test');
  if(seen)session.set('woongbi-support-seen',`${today}:test`);
  const storage=m=>({getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v)});
  const context={HTMLDialogElement:Element,Intl,Date,URL,location:{origin:'https://example.invalid'},document:{body,activeElement:new Element(),hidden:false,querySelector:()=>null,createElement:()=>new Element()},window:{localStorage:storage(local),sessionStorage:storage(session),addEventListener(){},removeEventListener(){}},setTimeout:f=>f(),fetch:async()=>({ok:true,json:async()=>({version:1,id:'test',date:'2026-09-24',changes:[{carrier:'SKT',device:'테스트 기종',plan:'테스트 요금제',monthly_fee:100000,join:'기기변경',before:500000,after:600000}]})})};
  vm.runInNewContext(fs.readFileSync('assets/support-notice.js','utf8'),context);await flush();
  assert.equal(body.children.length,1);
  assert.equal(Boolean(body.children[0].open),!hide&&!seen&&!dismissed);
  const dialog=body.children[0],details=dialog.children[1].children.find(x=>x.className==='support-notice-details');
  assert.ok(details);assert.equal(Boolean(details.open),false);
  dialog.close();assert.equal(local.get('woongbi-support-dismissed'),'test');
}
(async()=>{await quote(false);await quote(true);await popup();await popup(true);await popup(false,true);await popup(false,false,true);console.log('Customer UI: clipboard failure, success, popup-only and dismissal memory passed');})().catch(e=>{console.error(e);process.exitCode=1;});
