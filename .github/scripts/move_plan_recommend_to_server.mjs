import fs from 'node:fs';

const calculatorPaths=['src/rates.js','assets/rates.min.js'];
const serverBlock=`let wbPlanRecommendationSeq=0;function wbPlanRecommendStatus(){const e=G();return e?window.WoongbiPlanRecommendApi?.status?.(e.id,K.value)||"idle":"idle"}function wbPlanRecommendations(){const e=G();if(!e)return[];const t=new Map(J().map(e=>[e.id,e]));return(window.WoongbiPlanRecommendApi?.getCached?.(e.id,K.value)||[]).map(e=>{const n=t.get(e.plan_id);return n?{plan:n,badge:e.badge||"추천",reason:e.reason||""}:null}).filter(Boolean).slice(0,6)}function wbLoadPlanRecommendations(){const e=G();if(!e)return;const n=++wbPlanRecommendationSeq;window.WoongbiPlanRecommendApi?.load?.(e.id,K.value).then(()=>{n===wbPlanRecommendationSeq&&"recommend"===X.mode&&!t("plan-picker-backdrop")?.hidden&&oe()}).catch(()=>{n===wbPlanRecommendationSeq&&"recommend"===X.mode&&!t("plan-picker-backdrop")?.hidden&&oe()})}`;

for(const path of calculatorPaths){
  let source=fs.readFileSync(path,'utf8');

  const generalStart=source.indexOf('function wbGeneralRecommendPlan(e){');
  const generalEnd=source.indexOf('function wbQuickPremiumDevice(e){',generalStart);
  if(generalStart<0||generalEnd<0)throw new Error(`general plan recommendation markers missing in ${path}`);
  source=source.slice(0,generalStart)+source.slice(generalEnd);

  const planStart=source.indexOf('function wbPlanRecommendations(){');
  const planEnd=source.indexOf('function wbPlanModeSync(){',planStart);
  if(planStart<0||planEnd<0)throw new Error(`plan recommendation block markers missing in ${path}`);
  source=source.slice(0,planStart)+serverBlock+source.slice(planEnd);

  const oldMode='월 부담·데이터·무제한·혜택을 기준으로 먼저 볼 요금제만 추렸습니다.';
  if(!source.includes(oldMode))throw new Error(`plan recommendation mode text missing in ${path}`);
  source=source.replace(oldMode,'현재 가입 가능한 요금제 중 먼저 비교하기 좋은 요금제를 서버에서 추천합니다.');

  const ieStart=source.indexOf('function ie(){');
  const ieEnd=source.indexOf('function le(){',ieStart);
  if(ieStart<0||ieEnd<0)throw new Error(`plan select refresh markers missing in ${path}`);
  let ieBlock=source.slice(ieStart,ieEnd);
  const ieTail=',le(),ne(),ze()}';
  if(!ieBlock.includes(ieTail))throw new Error(`plan recommendation preload marker missing in ${path}`);
  ieBlock=ieBlock.replace(ieTail,',le(),ne(),wbLoadPlanRecommendations(),ze()}');
  source=source.slice(0,ieStart)+ieBlock+source.slice(ieEnd);

  const emptyOld='e.textContent="recommend"===X.mode?"추천으로 추릴 수 있는 일반 요금제가 없습니다. 전체 요금제에서 확인해 주세요.":"조건에 맞는 요금제가 없습니다. 검색어나 필터를 조금 넓혀보세요."';
  const emptyNew='e.textContent="recommend"===X.mode?"loading"===wbPlanRecommendStatus()?"추천 요금제를 불러오는 중입니다.":"unavailable"===wbPlanRecommendStatus()?"추천 요금제를 불러오지 못했습니다. 전체 요금제에서 확인해 주세요.":"추천 조건에 맞는 요금제가 없습니다. 전체 요금제에서 확인해 주세요.":"조건에 맞는 요금제가 없습니다. 검색어나 필터를 조금 넓혀보세요."';
  if(!source.includes(emptyOld))throw new Error(`recommendation empty-state marker missing in ${path}`);
  source=source.replace(emptyOld,emptyNew);

  const eventOld='window.addEventListener("woongbi:quote-api-loaded",()=>ze());[I,K].forEach';
  const eventNew='window.addEventListener("woongbi:quote-api-loaded",()=>ze());window.addEventListener("woongbi:plan-recommend-ready",()=>{"recommend"===X.mode&&!t("plan-picker-backdrop")?.hidden&&oe()}),window.addEventListener("woongbi:plan-recommend-unavailable",()=>{"recommend"===X.mode&&!t("plan-picker-backdrop")?.hidden&&oe()});[I,K].forEach';
  if(!source.includes(eventOld))throw new Error(`plan recommendation event marker missing in ${path}`);
  source=source.replace(eventOld,eventNew);

  for(const forbidden of [
    'function wbGeneralRecommendPlan',
    '월 기본료를 낮춰 시작하기 좋은 일반 요금제',
    '월 부담과 데이터 제공량을 함께 비교하기 좋은 구간',
    '영상·SNS 사용량이 많은 경우 먼저 비교하기 좋은 구성',
    '데이터 무제한 표기가 있는 요금제 중 월 부담이 낮은 구성',
    '콘텐츠·구독·디바이스 혜택이 요금제명에 명시된 구성',
    '가입 가능한 일반 요금제 중 월 기본료가 낮은 순서로 함께 비교',
  ]) if(source.includes(forbidden))throw new Error(`public selected-plan rule remains in ${path}: ${forbidden}`);
  for(const required of ['WoongbiPlanRecommendApi','wbLoadPlanRecommendations','wbPlanRecommendStatus'])if(!source.includes(required))throw new Error(`server plan recommendation marker missing in ${path}: ${required}`);
  fs.writeFileSync(path,source,'utf8');
}

{
  const path='rates.html';
  let source=fs.readFileSync(path,'utf8');
  const old='<script src="assets/rates.min.js?v=20261001-11" defer></script>';
  const replacement='<script src="/assets/plan-recommend-api-bridge.min.js?v=20261001-1" defer></script><script src="assets/rates.min.js?v=20261001-12" defer></script>';
  if(!source.includes(old))throw new Error('rates script version marker missing');
  source=source.replace(old,replacement);
  fs.writeFileSync(path,source,'utf8');
}

{
  const path='sw.js';
  let source=fs.readFileSync(path,'utf8');
  if(!source.includes('const CACHE="woongbi-pwa-20261001-4"'))throw new Error('service worker cache marker missing');
  source=source.replace('const CACHE="woongbi-pwa-20261001-4"','const CACHE="woongbi-pwa-20261001-5"');
  const old='"/assets/recommend-api-bridge.min.js","/assets/mvno-api-bridge.min.js"';
  const replacement='"/assets/recommend-api-bridge.min.js","/assets/plan-recommend-api-bridge.min.js","/assets/mvno-api-bridge.min.js"';
  if(!source.includes(old))throw new Error('service worker bridge marker missing');
  source=source.replace(old,replacement);
  fs.writeFileSync(path,source,'utf8');
}

console.log('moved selected-device plan recommendation rules behind private API');
