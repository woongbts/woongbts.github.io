import fs from 'node:fs';

const paths=['src/rates.js','assets/rates.min.js'];
const startMarker='const Je=t("studyphone-plan");function Xe(){';
const endMarker='const ot=t("mvno-provider"),rt=t("mvno-plan")';
const fetchStart='fetch("data/studyphone.json?v=20260916-1")';
const fetchEnd='Promise.all([fetch("data/catalog.json?v=20260918-5")';

const replacement=`const Je=t("studyphone-plan");function Xe(){return(l?.plans||[]).find(e=>e.id===Je?.value)||null}function Qe(e){return e?window.WoongbiStudyphoneApi?.item?.(e.id)?.quote||null:null}function et(){const t=l?.device,n=Xe();if(!t||!n)return"";const o=Qe(n),r=o?.known;return["[웅비통신 공신폰 상담]",\`통신사: \${t.provider||"KT M모바일"}\`,\`기종: \${t.name||"갤럭시 A17 공신폰"}\${t.model?" ("+t.model+")":""}\`,\`요금제: \${n.name}\`,\`월 기본료: \${e(n.monthly_fee)}\`,\`통화: \${n.voice||"확인 필요"}\`,\`문자: \${n.sms||"확인 필요"}\`,\`데이터: \${n.data||"확인 필요"}\`,\`공시지원금: \${r?e(o.support):"매장 확인"}\`,\`할부원금: \${r?e(o.principal):"매장 확인"}\`,\`예상 월 납부액: \${r?e(o.monthly):"매장 확인"}\`,"※ 실제 개통 조건은 상담 시점에 최종 확인해 주세요."].join("\\n")}function tt(){const n=t("studyphone-plan-list");if(!n)return;const o=l?.device,r=l?.plans||[];o&&r.length?n.innerHTML=r.map(t=>{const n=Qe(t),o=n?.known;return\`<button type="button" class="studyphone-plan-card\${Je?.value===t.id?" active":""}" data-studyphone-plan="\${t.id}"><span>\${t.name}</span><strong>\${e(t.monthly_fee)}</strong><small>통화 \${t.voice} · 문자 \${t.sms} · 데이터 \${t.data}</small><div><em>공시지원금</em><b>\${o?e(n.support):"불러오는 중"}</b></div><div><em>할부원금</em><b>\${o?e(n.principal):"불러오는 중"}</b></div><div class="studyphone-card-total"><em>월 예상 납부액</em><b>\${o?e(n.monthly):"불러오는 중"}</b></div></button>\`}).join(""):n.innerHTML="<p>공신폰 요금 정보를 불러오고 있습니다.</p>"}function nt(){const n=l?.device,o=Xe();if(!n)return;if(t("studyphone-retail-view").textContent=e(n.retail_price),t("studyphone-retail").textContent=e(n.retail_price),!o)return["studyphone-voice","studyphone-sms","studyphone-data","studyphone-plan-fee","studyphone-total","studyphone-support","studyphone-principal","studyphone-device-monthly","studyphone-interest","studyphone-service-fee"].forEach(e=>{const n=t(e);n&&(n.textContent="—")}),t("studyphone-summary").textContent="요금제를 선택하면 서버에서 현재 공시지원금과 월 예상 납부액을 확인합니다.",void tt();const r=Qe(o);t("studyphone-voice").textContent=o.voice||"—",t("studyphone-sms").textContent=o.sms||"—",t("studyphone-data").textContent=o.data||"—",t("studyphone-plan-fee").textContent=e(o.monthly_fee);if(!r?.known)return["studyphone-total","studyphone-support","studyphone-principal","studyphone-device-monthly","studyphone-interest","studyphone-service-fee"].forEach(e=>{const n=t(e);n&&(n.textContent="—")}),t("studyphone-summary").textContent="현재 공신폰 견적을 서버에서 확인하고 있습니다.",void tt();const a=Number(r.months)||Number(n.installment_months)||24;t("studyphone-total").textContent=e(r.monthly),t("studyphone-support").textContent=e(r.support),t("studyphone-principal").textContent=e(r.principal),t("studyphone-device-monthly").textContent=e(r.inst?.monthly),t("studyphone-interest").textContent=e(r.inst?.fee),t("studyphone-service-fee").textContent=e(r.service),t("studyphone-summary").textContent=\`\${o.name} · 할부원금 \${e(r.principal)} · 월 단말금 \${e(r.inst?.monthly)} + 요금제 \${e(r.service)} = 월 예상 \${e(r.monthly)} (\${a}개월 기준)\`,tt()}function wbApplyStudyphoneSnapshot(e){if(!e?.device||!Array.isArray(e?.items))throw Error("studyphone-api-invalid");const n=Je?.value||"";l={meta:e.meta||{},device:e.device,plans:e.items.map(e=>e.plan).filter(Boolean)},h("studyphone-updated",l?.meta?.updated_at),Je&&(Je.innerHTML="",v(Je,"","요금제를 선택하세요"),(l.plans||[]).forEach(t=>v(Je,t.id,\`\${t.name} · \${e(t.monthly_fee)}\`)),[...Je.options].some(e=>e.value===n)&&(Je.value=n)),nt(),tt(),document.documentElement.dataset.studyphoneUi="ready"}function wbStudyphoneFail(){document.documentElement.dataset.studyphoneUi="unavailable";const e=t("studyphone-plan-list");e&&(e.innerHTML="<p>공신폰 요금 정보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</p>"),t("studyphone-summary")&&(t("studyphone-summary").textContent="현재 자동 견적을 불러오지 못했습니다. 상담으로 확인해 주세요.")}async function wbLoadStudyphone(){try{const e=window.WoongbiStudyphoneApi;if(!e?.load)throw Error("studyphone-api-bridge-missing");wbApplyStudyphoneSnapshot(await e.load())}catch(e){wbStudyphoneFail()}}Je?.addEventListener("change",nt),t("studyphone-plan-list")?.addEventListener("click",e=>{const t=e.target.closest("[data-studyphone-plan]");t&&Je&&(Je.value=t.dataset.studyphonePlan,nt(),document.querySelector('[data-panel="studyphone"]')?.scrollIntoView({behavior:"smooth",block:"start"}))}),t("copy-studyphone-quote")?.addEventListener("click",async()=>{const e=et(),n=t("studyphone-quote-status");if(!e)return void(n&&(n.textContent="요금제를 먼저 선택해 주세요."));const o=await b(e);n&&(n.textContent=o?"선택 내용을 복사했습니다.":"복사하지 못했습니다. 다시 시도해 주세요.")}),t("share-studyphone-quote")?.addEventListener("click",()=>_("웅비통신 공신폰 상담",et(),"studyphone-quote-status")),t("consult-studyphone-quote")?.addEventListener("click",()=>y(et(),"studyphone-quote-status"));`;

for(const path of paths){
  let source=fs.readFileSync(path,'utf8');
  const start=source.indexOf(startMarker);
  const end=source.indexOf(endMarker,start);
  if(start<0||end<0||end<=start)throw new Error(`studyphone block markers missing: ${path}`);
  source=source.slice(0,start)+replacement+source.slice(end);

  const fsStart=source.indexOf(fetchStart);
  const fsEnd=source.indexOf(fetchEnd,fsStart);
  if(fsStart<0||fsEnd<0||fsEnd<=fsStart)throw new Error(`studyphone fetch markers missing: ${path}`);
  source=source.slice(0,fsStart)+'wbLoadStudyphone(),'+source.slice(fsEnd);

  for(const forbidden of ['data/studyphone.json','installment_apr','public_support','function Qe(e){const t=l?.device','Math.pow(1+o,t)']){
    if(source.includes(forbidden))throw new Error(`studyphone public marker remains in ${path}: ${forbidden}`);
  }
  for(const required of ['WoongbiStudyphoneApi?.item','wbLoadStudyphone()','studyphoneUi="ready"']){
    if(!source.includes(required))throw new Error(`studyphone server marker missing in ${path}: ${required}`);
  }
  fs.writeFileSync(path,source,'utf8');
}
console.log('studyphone public calculations moved to server bridge');
