const $=id=>document.getElementById(id);
const choices=['marketing_use','ad_sms','ad_kakao','ad_call'];
let formHash='',requestId=crypto.randomUUID(),busy=false,idleTimer,nextTimer;
function clearFields(){
 $('intake-form').reset();choices.forEach(p=>$(p).checked=false);
 choices.slice(1).forEach(p=>$(p).disabled=true);
 $('customer-name').value='';$('customer-phone').value='';$('website').value='';$('adult').checked=false;
 $('submit').disabled=true;requestId=crypto.randomUUID();
}
function armIdle(){clearTimeout(idleTimer);idleTimer=setTimeout(()=>finish('입력 대기 시간이 지나 내용을 지웠습니다. 다시 작성해 주세요.'),180000);}
function nextCustomer(){
 clearTimeout(nextTimer);clearFields();$('intake-form').hidden=!formHash;$('next').hidden=true;
 $('status').textContent=formHash?'고객님께서 직접 작성해 주세요.':'연결 상태를 확인하고 페이지를 새로 열어 주세요.';
}
function finish(message){
 clearTimeout(idleTimer);clearFields();$('intake-form').hidden=true;$('next').hidden=false;
 $('status').textContent=message;$('status').focus();
 clearTimeout(nextTimer);nextTimer=setTimeout(nextCustomer,5000);
}
$('marketing_use').addEventListener('change',()=>{
 const on=$('marketing_use').checked;
 choices.slice(1).forEach(p=>{$(p).disabled=!on;if(!on)$(p).checked=false;});
 $('submit').disabled=!on||busy;
});
$('intake-form').addEventListener('input',armIdle);
$('decline').addEventListener('click',()=>{if(!busy)finish('동의 없이 종료했습니다. 입력하신 정보는 전송하지 않았습니다.');});
$('next').addEventListener('click',nextCustomer);
$('intake-form').addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;
 if(!$('marketing_use').checked){finish('동의 없이 종료했습니다.');return;}
 if(!$('adult').checked){$('status').textContent='성인 고객 본인이 작성하는지 확인해 주세요.';$('adult').focus();return;}
 busy=true;clearTimeout(idleTimer);$('submit').disabled=true;$('decline').disabled=true;$('status').textContent='접수 중입니다. 잠시만 기다려 주세요.';
 const body={request_id:requestId,form_hash:formHash,name:$('customer-name').value,phone:$('customer-phone').value,adult_confirmed:true,website:$('website').value,choices:Object.fromEntries(choices.map(p=>[p,$(p).checked]))};
 try{
  const r=await fetch('/api/intake',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(20000)});
  const result=await r.json();if(!r.ok||!result.ok)throw new Error(result.error||'접수하지 못했습니다.');
  finish('접수되었습니다. 감사합니다. 5초 뒤 다음 고객 화면으로 돌아갑니다.');
 }catch(e){$('status').textContent=e.message||'연결을 확인하고 다시 접수해 주세요.';armIdle();}
 finally{busy=false;$('submit').disabled=!$('marketing_use').checked;$('decline').disabled=false;}
});
addEventListener('pagehide',()=>{clearFields();clearTimeout(idleTimer);clearTimeout(nextTimer);});
addEventListener('pageshow',event=>{if(event.persisted)nextCustomer();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!busy){clearFields();clearTimeout(idleTimer);}});
(async()=>{
 try{
  const r=await fetch('/api/intake-form',{credentials:'omit',cache:'no-store'});
  const data=await r.json();if(!r.ok||!data.ok)throw new Error('동의 내용을 불러오지 못했습니다. 새로고침해 주세요.');
  formHash=data.form_hash;
  for(const key of ['purpose','items','retention','withdrawal','refusal','advertising'])$(key).textContent=data.policy[key];
  for(const key of ['privacy_label','advertising_label','channel_notice','adult_notice','record_notice'])$(key.replaceAll('_','-')).textContent=data.policy[key];
  $('version').textContent='동의 문구 버전 '+data.policy.version;
  nextCustomer();
 }catch(e){$('status').textContent=e.message;}
})();
