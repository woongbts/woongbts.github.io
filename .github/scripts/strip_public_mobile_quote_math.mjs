import fs from 'node:fs';

const sourcePath='src/rates.js';
const assetPath='assets/rates.min.js';
let source=fs.readFileSync(sourcePath,'utf8');
const before=source.length;

function locateFunction(src,name){
  const marker=`function ${name}(`;
  const start=src.indexOf(marker);
  if(start<0)throw new Error(`${name} function not found`);
  const open=src.indexOf('{',start);
  let depth=1,i=open+1,quote=null,escape=false;
  for(;i<src.length&&depth;i++){
    const ch=src[i];
    if(quote){if(escape){escape=false;continue}if(ch==='\\'){escape=true;continue}if(ch===quote)quote=null;continue}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue}
    if(ch==='{')depth++;else if(ch==='}')depth--;
  }
  if(depth)throw new Error(`${name} function did not close`);
  return{start,end:i};
}
function replaceFunction(name,replacement=''){
  const {start,end}=locateFunction(source,name);
  source=source.slice(0,start)+replacement+source.slice(end);
}

for(const name of ['wbValidPublicSupport','N','R','W','T'])replaceFunction(name,'');

replaceFunction('ce',`function ce(e){return window.WoongbiQuoteApi?.getCurrent?.(e)||null}`);

replaceFunction('se',`function se(){const t=G(),n=O();if(!t||!n)return"";const o=ce(j.value),r="contract"===j.value?"선택약정 25%":"공시지원금";Ue();const a=["[웅비통신 간편견적 상담]",\`견적번호: \${x}\`,\`통신사: \${I.value}\`,\`가입유형: \${K.value}\`,\`기종: \${t.name}\${t.model_code?" ("+t.model_code+")":""}\`,\`요금제: \${n.name} / \${e(n.monthly_fee)}\`,\`계산기준: \${r}\`,\`할부: \${D.value||24}개월\`,\`복지할인: \${H.options[H.selectedIndex]?.text||"미적용"}\`];return o?.known?a.push(\`예상 월 납부액: \${e(o.monthly)}\`,\`월 단말금 (할부이자 포함): \${e(o.inst.monthly)}\`,\`월 통신요금: \${e(o.service)}\`):a.push("현재 자동 계산 금액을 불러오지 못해 상담에서 최종 확인이 필요합니다."),a.push("단말 할부이자는 연 5.9% 기준 예상치입니다. 가족·인터넷 결합과 매장 추가지원금은 포함하지 않습니다.","요금제 유지 기간·부가서비스·할인 자격·재고·프로모션은 매장에서 최종 확인 부탁드립니다."),a.push(\`견적 링크: \${pe()}\`),a.join("\\n")}`);

replaceFunction('We',`function We(e){if(!e)return null;let t=null;try{t=new URL(e.url||"",location.href).searchParams}catch(e){}const r=e.deviceId||t?.get("d")||"",a=e.planId||t?.get("p")||"",i=(o?.devices||[]).find(e=>e.id===r)||null,l=(o?.mobile_plans||[]).find(e=>e.id===a)||null,c=e.carrier||t?.get("c")||i?.carrier||"",s=e.join||t?.get("j")||"",u=e.method||t?.get("m")||"support";return{id:e.id||"저장 견적",device:e.device||i?.name||"—",carrier:c||"—",join:s||"—",plan:e.plan||l?.name||"—",method:"contract"===u?"선택약정":"공시지원금",monthly:n(e.monthly)?Number(e.monthly):null,total24:n(e.total24)?Number(e.total24):null,deviceMonthly:n(e.deviceMonthly)?Number(e.deviceMonthly):null,serviceMonthly:n(e.serviceMonthly)?Number(e.serviceMonthly):null}}`);

replaceFunction('De',`async function De(){const n=t("device-compare-results");if(!n)return;const r=O(),a=G();if(!a||!r)return void(n.innerHTML="<p>기종과 요금제를 선택한 뒤 비교할 기종을 추가해 주세요.</p>");const i=[a.id,t("device-compare-2").value,t("device-compare-3").value].filter((e,t,n)=>e&&n.indexOf(e)===t);if(i.length<2)return void(n.innerHTML="<p>비교 기종을 하나 이상 추가하면 같은 요금제로 나란히 비교합니다.</p>");const l=window.WoongbiQuoteApi;if(!l?.quotePair)return void(n.innerHTML="<p>비교 견적을 불러올 준비 중입니다. 잠시 후 다시 확인해 주세요.</p>");const c=De.seq=(De.seq||0)+1;n.innerHTML="<p>비교 견적을 불러오는 중입니다.</p>";const s=await Promise.all(i.map(async(t,n)=>{const a=(o?.devices||[]).find(e=>e.id===t);if(!a||!L(a,r,K.value))return{index:n,device:a,invalid:!0};try{const e=await l.quotePair({device_id:a.id,plan_id:r.id,join_type:K.value,months:Number(D.value)||24,welfare_type:H.value||"none"});return{index:n,device:a,pair:e}}catch(e){return{index:n,device:a,error:!0}}}));if(c!==De.seq)return;n.innerHTML="";s.forEach(t=>{const a=document.createElement("article");if(a.className="device-compare-card",t.invalid)return a.innerHTML=\`<span>\${0===t.index?"현재 선택":"비교 기종"}</span><strong>\${t.device?.name||"기종"}</strong><em>선택한 요금제로 가입 불가</em>\`,void n.appendChild(a);const i=t.pair?.support,l=t.pair?.contract,c=[i,l].filter(e=>e?.known).sort((e,t)=>e.total24-t.total24)[0],s=i?.known?e(i.support):"매장 확인",u=i?.known?e(i.monthly):"매장 확인",d=l?.known?e(l.monthly):"—",m=c?"support"===c.method?"공시지원":"선택약정":"확인 필요";a.innerHTML=\`<span>\${0===t.index?"현재 선택":"비교 기종"}</span><strong>\${t.device?.name||"기종"}</strong><em>출고가 \${n=>n}</em>\`.replace("${n=>n}",t.device&&n?e(t.device.retail_price):"—")+\`<div><small>공시지원금</small><b>\${s}</b></div><div><small>공시 월납부</small><b>\${u}</b></div><div><small>선약 월납부</small><b>\${d}</b></div><i>\${c?m+" 추천":"최종 금액 확인 필요"}</i>\`;n.appendChild(a)})}`);

replaceFunction('ze',`function ze(){ne();const a=G(),i=O(),l="contract"===j.value,c=a&&n(a.retail_price)&&Number(a.retail_price)>0;t("device-price-view").textContent=c?e(a.retail_price):"매장 확인",t("plan-fee-view").textContent=i&&n(i.monthly_fee)?e(i.monthly_fee):"—",t("discount-amount-label").textContent=l?"선택약정 월 할인":"공시지원금",t("principal-label").textContent=l?"단말 할부원금":"공시지원 반영 할부원금",t("plan-discount-label").textContent=l?"선택약정 할인":"요금 할인",t("extra-support-view").textContent="매장 문의",document.querySelectorAll(".compare-card").forEach(e=>e.classList.toggle("active",e.dataset.method===j.value));const s=t("mobile-data-note");if(!a||!i||!c)return Y(),s&&(s.textContent=!c&&a?"이 기종의 현재 출고가는 매장에서 최신 금액을 확인해 주세요.":a?"요금제를 선택하세요.":"기종과 요금제를 선택하면 서버에서 자동 계산합니다."),t("calc-summary").textContent=!c&&a?"출고가 확인 후 월 납부액을 계산할 수 있습니다.":"통신사, 가입유형, 할인방식, 기종, 요금제를 선택하면 자동으로 계산됩니다.",void(window.WoongbiQuoteApi?.sync?.());Y(),t("discount-amount-view").textContent="—",t("plan-discount-view").textContent="—",["compare-support-monthly","compare-contract-monthly"].forEach(e=>t(e)&&(t(e).textContent="—")),t("compare-support-benefit").textContent="지원금 —",t("compare-contract-benefit").textContent="월 할인 —",t("compare-best").textContent="계산 중",t("compare-diff").textContent="선택한 조건의 견적을 불러오고 있습니다.",["explain-price","explain-device-discount","explain-principal","explain-interest","explain-device-monthly","explain-plan-fee","explain-contract-discount","explain-welfare","explain-service","explain-monthly-total"].forEach(e=>{t(e)&&(t(e).textContent="—")}),t("explain-note")&&(t("explain-note").textContent="서버에서 현재 조건을 확인하고 있습니다."),Ze(),function(){if(g)return;const e=G(),t=O();e&&t&&history.replaceState(null,"",pe())}(),window.WoongbiQuoteApi?.sync?.()}`+
`window.addEventListener("woongbi:quote-ready",()=>{me(),void De()}),window.addEventListener("woongbi:quote-unavailable",()=>me()),window.addEventListener("woongbi:quote-api-loaded",()=>ze())`);

for(const marker of ['function N(','function R(','function W(','function T(','function wbValidPublicSupport(','const n=.059/12','28600),label:"생계·의료급여"','45100)','23650']){
  if(source.includes(marker))throw new Error(`public mobile quote math marker remains: ${marker}`);
}
for(const required of ['window.WoongbiQuoteApi?.getCurrent','window.WoongbiQuoteApi?.sync','l.quotePair','function We(e){','function ze(){']){
  if(!source.includes(required))throw new Error(`server quote wiring missing: ${required}`);
}

fs.writeFileSync(sourcePath,source,'utf8');
fs.writeFileSync(assetPath,source,'utf8');
console.log(`public mobile quote math stripped: ${before-source.length} bytes removed; ${source.length} bytes remain`);
