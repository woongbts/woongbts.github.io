const $=id=>document.getElementById(id);
let token=location.hash.slice(1), formHash='', busy=false, expiryTimer;
history.replaceState(null,'',location.pathname); // Keep the bearer token in memory only.
const purposes=['marketing_use','ad_sms','ad_kakao','ad_call'];
async function api(path,body){
  const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store',credentials:'omit'});
  const data=await r.json(); if(!r.ok)throw new Error(data.error||'등록할 수 없습니다.');return data;
}
function finish(message){
  clearTimeout(expiryTimer);token='';formHash='';$('form').hidden=true;$('customer').textContent='';
  purposes.forEach(p=>$(p).checked=false);$('status').textContent=message;
}
$('marketing_use').addEventListener('change',()=>purposes.slice(1).forEach(p=>{$(p).disabled=!$('marketing_use').checked;if($(p).disabled)$(p).checked=false;}));
async function submit(decline){
  if(busy||!token)return;busy=true; $('submit').disabled=$('decline').disabled=true;
  const choices=Object.fromEntries(purposes.map(p=>[p,decline?false:$(p).checked]));
  try{
    const r=await api('/api/submit',{token,form_hash:formHash,choices});
    finish(decline?'동의하지 않은 선택을 등록했습니다. 기본 서비스 이용에는 제한이 없습니다.':'선택하신 내용을 등록했습니다. 감사합니다.');
    $('receipt').textContent='접수번호 '+r.receipt_id+' · '+new Date(r.captured_at).toLocaleString('ko-KR');
  }catch(e){$('status').textContent=e.message;}
  finally{busy=false;$('submit').disabled=$('decline').disabled=false;}
}
$('submit').addEventListener('click',()=>submit(false));
$('decline').addEventListener('click',()=>submit(true));
addEventListener('pagehide',()=>finish('종료된 화면입니다. 새 링크를 요청해 주세요.'));
(async()=>{
  if(!/^[a-f0-9]{64}$/.test(token)){finish('매장에서 발급한 동의 링크로 접속해 주세요.');return;}
  try{
    const r=await api('/api/form',{token});formHash=r.form_hash;
    for(const key of ['purpose','items','retention','withdrawal','refusal','advertising'])$(key).textContent=r.policy[key];
    $('customer').textContent=r.customer_label;$('version').textContent='동의서 '+r.policy.version;
    $('status').textContent='고객님께서 직접 읽고 선택해 주세요. 이 링크는 10분 동안 한 번만 사용할 수 있습니다.';
    purposes.forEach(p=>$(p).checked=false);$('form').hidden=false;
    expiryTimer=setTimeout(()=>finish('유효기간이 지났습니다. 새 링크를 요청해 주세요.'),Math.max(0,Date.parse(r.expires_at)-Date.now()));
  }catch(e){finish(e.message);}
})();
