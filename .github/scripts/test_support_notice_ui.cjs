'use strict';
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('assets/support-notice.js','utf8');
const home=fs.readFileSync('index.html','utf8');
const previous=JSON.parse(fs.readFileSync('data/support-notice.json','utf8'));
new vm.Script(source,{filename:'assets/support-notice.js'});
assert.match(home,/support-notice\.js\?v=20261008-verified3/);
assert.match(source,/todayUtc - noticeUtc > 7 \* 86400000/);
assert.match(source,/notice_total_count/);
function fakeElement(tag){
 return {tag,children:[],style:{},textContent:'',className:'',
   append(...items){this.children.push(...items)},
   setAttribute(){},addEventListener(){},close(){},showModal(){},
 };
}
async function render(data){
 const dialogs=[],timers=[];
 const document={
   hidden:false,
   createElement:tag=>fakeElement(tag),
   querySelector:()=>null,
   body:{classList:{add(){},remove(){}},append(element){if(element.tag==='dialog')dialogs.push(element)}},
 };
 const store={getItem:()=>null,setItem(){}};
 const environment={
   HTMLDialogElement:class{},
   document,window:{localStorage:store,sessionStorage:store,addEventListener(){},removeEventListener(){}},
   location:{origin:'https://woongbts.github.io'},
   URL,Number,Date,JSON,Promise,
   Intl:{DateTimeFormat:class {format(){return '2026-10-08'}}},
   setTimeout:fn=>timers.push(fn),
   fetch:()=>Promise.resolve({ok:true,json:()=>Promise.resolve(data)}),
 };
 vm.runInNewContext(source,environment,{timeout:4000});
 await new Promise(resolve=>setImmediate(resolve));
 return {dialogs,timers};
}
(async()=>{
 const stale=await render(previous);
 assert.equal(stale.dialogs.length,0,'September popup must not show to October visitors');
 assert.equal(stale.timers.length,0,'stale alert must not schedule an automatic popup');
 const fresh=await render({...previous,date:'2026-10-08',id:'confirmed-today',notice_total_count:87});
 assert.equal(fresh.dialogs.length,1,'same verified changes with a fresh revision create a customer popup');
 assert.ok(fresh.timers.length>0,'fresh verified change must schedule unobtrusive popup');
 console.log('Support popup: stale notices suppressed; fresh verified changes prepared for modal.');
})().catch(error=>{console.error(error);process.exit(1)});
