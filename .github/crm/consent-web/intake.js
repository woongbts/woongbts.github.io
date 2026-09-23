import {createHandwritingPad} from './handwriting.js';
const $=id=>document.getElementById(id);
const choices=['marketing_use','ad_sms','ad_kakao','ad_call'];
let formHash='',policy=null,requestId=crypto.randomUUID(),busy=false,idleTimer,nextTimer,stage='prepare',snapshot=null;
const error=message=>{$('status').textContent=message;};
const namePad=createHandwritingPad($('name-pad'),armIdle,error);
const signaturePad=createHandwritingPad($('signature-pad'),armIdle,error);
function clearFields(){
 $('intake-form').reset();choices.forEach(p=>$(p).checked=false);choices.slice(1).forEach(p=>$(p).disabled=true);
 $('customer-phone').value='';$('website').value='';$('adult').checked=false;
 namePad.clear();signaturePad.clear();snapshot=null;stage='prepare';
 $('prepare-step').hidden=false;$('customer-step').hidden=true;$('phone-summary').textContent='';$('choice-summary').textContent='';
 $('step-label').textContent='1. 직원 준비 — 고객 의사를 확인하며 입력해 주세요.';
 requestId=crypto.randomUUID();
}
function armIdle(){if(busy)return;clearTimeout(idleTimer);idleTimer=setTimeout(()=>finish('입력 대기 시간이 지나 내용을 지웠습니다. 다시 작성해 주세요.'),180000);}
function nextCustomer(){
 clearTimeout(nextTimer);clearFields();$('intake-form').hidden=!formHash;$('next').hidden=true;
 $('status').textContent=formHash?'전화번호와 선택 내용을 준비한 뒤 고객에게 화면을 넘겨 주세요.':'연결을 확인하고 새로고침해 주세요.';
}
function finish(message){
 clearTimeout(idleTimer);clearFields();$('intake-form').hidden=true;$('next').hidden=false;
 error(message);$('status').focus();clearTimeout(nextTimer);nextTimer=setTimeout(nextCustomer,5000);
}
function setBusy(value){
 busy=value;for(const button of document.querySelectorAll('#intake-form button'))button.disabled=value;
 $('adult').disabled=value;namePad.setDisabled(value);signaturePad.setDisabled(value);
}
function returnToPreparation(){
 if(busy)return;namePad.clear();signaturePad.clear();$('adult').checked=false;snapshot=null;stage='prepare';
 $('prepare-step').hidden=false;$('customer-step').hidden=true;
 $('step-label').textContent='1. 직원 준비 — 고객 의사를 확인하며 입력해 주세요.';
 error('선택 내용을 수정하면 손글씨를 다시 작성해야 합니다.');$('customer-phone').focus();armIdle();
}
$('marketing_use').addEventListener('change',()=>{const on=$('marketing_use').checked;choices.slice(1).forEach(p=>{$(p).disabled=!on;if(!on)$(p).checked=false;});});
$('intake-form').addEventListener('input',armIdle);
$('handoff').addEventListener('click',()=>{
 if(busy)return;
 if(!$('marketing_use').checked){error('개인정보 이용 동의를 선택하지 않은 경우 아래의 동의하지 않고 종료를 눌러 주세요.');return;}
 const phone=$('customer-phone').value.replace(/[\s()-]/g,'');
 if(!/^01[016789]\d{7,8}$/.test(phone)){error('휴대전화번호를 확인해 주세요.');$('customer-phone').focus();return;}
 snapshot={phone,choices:Object.fromEntries(choices.map(p=>[p,$(p).checked]))};
 namePad.clear();signaturePad.clear();$('adult').checked=false;
 $('phone-summary').textContent='연락처 '+phone;
 const labels={marketing_use:'개인정보 수집·이용',...policy.channels};
 $('choice-summary').replaceChildren();
 for(const p of choices){const line=document.createElement('p');line.textContent=labels[p]+': '+(snapshot.choices[p]?'동의':'미동의');$('choice-summary').append(line);}
 $('prepare-step').hidden=true;$('customer-step').hidden=false;stage='customer';
 $('step-label').textContent='2. 고객 작성 — 선택 내용을 확인하고 이름·서명을 써 주세요.';
 error('고객님께서 직접 확인하고 작성해 주세요.');$('status').focus();armIdle();
});
$('edit-choices').addEventListener('click',returnToPreparation);
$('clear-name').addEventListener('click',()=>{if(!busy){namePad.clear();armIdle();}});
$('clear-signature').addEventListener('click',()=>{if(!busy){signaturePad.clear();armIdle();}});
$('decline').addEventListener('click',()=>{if(!busy)finish('동의 없이 종료했습니다. 입력 정보와 손글씨는 전송하지 않았습니다.');});
$('next').addEventListener('click',nextCustomer);
$('intake-form').addEventListener('submit',async event=>{
 event.preventDefault();if(busy||stage!=='customer'||!snapshot)return;
 if(!$('adult').checked){error('성인 고객 본인이 작성하는지 확인해 주세요.');$('adult').focus();return;}
 let handwriting_name,signature;
 try{handwriting_name=namePad.value();}catch(e){error('이름: '+e.message);return;}
 try{signature=signaturePad.value();}catch(e){error('서명: '+e.message);return;}
 // Handoff freezes the exact phone/choices the customer saw. Editing returns to preparation and clears both pads.
 const body={request_id:requestId,form_hash:formHash,...snapshot,handwriting_name,signature,adult_confirmed:true,customer_confirmed:true,website:$('website').value};
 setBusy(true);clearTimeout(idleTimer);error('접수 중입니다. 잠시만 기다려 주세요.');
 try{
  const r=await fetch('/api/intake',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(20000)});
  const result=await r.json();if(!r.ok||!result.ok)throw new Error(result.error||'접수하지 못했습니다.');
  finish('접수되었습니다. 감사합니다. 5초 뒤 다음 고객 화면으로 돌아갑니다.');
 }catch(e){error(e.name==='TimeoutError'?'연결이 지연되었습니다. 같은 내용으로 다시 접수해 주세요.':e.message);}
 finally{setBusy(false);if(stage==='customer')armIdle();}
});
addEventListener('pagehide',()=>{clearFields();clearTimeout(idleTimer);clearTimeout(nextTimer);});
addEventListener('pageshow',e=>{if(e.persisted)nextCustomer();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!busy){clearFields();clearTimeout(idleTimer);}});
(async()=>{
 try{
  const r=await fetch('/api/intake-form',{credentials:'omit',cache:'no-store'}),data=await r.json();
  if(!r.ok||!data.ok)throw new Error('동의 내용을 불러오지 못했습니다. 새로고침해 주세요.');
  formHash=data.form_hash;policy=data.policy;
  for(const key of ['purpose','items','retention','withdrawal','refusal','advertising'])$(key).textContent=policy[key];
  for(const key of ['privacy_label','advertising_label','channel_notice','adult_notice','record_notice'])$(key.replaceAll('_','-')).textContent=policy[key];
  for(const key of ['purpose','items','retention','refusal','withdrawal','advertising','channel_notice','record_notice']){const p=document.createElement('p');p.textContent=policy[key];$('customer-policy').append(p);}
  $('version').textContent='동의 문구 버전 '+policy.version;nextCustomer();
 }catch(e){error(e.message);}
})();
