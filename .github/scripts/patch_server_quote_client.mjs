import fs from 'node:fs';

const paths=['src/rates.js','assets/rates.min.js'];
for(const path of paths){
  let source=fs.readFileSync(path,'utf8');
  const broken='window.addEventListener("woongbi:quote-api-loaded",()=>ze())[I,K].forEach';
  const fixed='window.addEventListener("woongbi:quote-api-loaded",()=>ze());[I,K].forEach';
  if(source.includes(broken)) source=source.replace(broken,fixed);
  else if(!source.includes(fixed)) throw new Error(`quote-api-loaded handoff marker missing: ${path}`);

  const saveOld='Ue();const o=ce(j.value),r={';
  const saveNew='Ue();const o=ce(j.value);if(!o?.known)return window.WoongbiQuoteApi?.sync?.(),void(t("quote-action-status").textContent="자동 계산을 불러온 뒤 저장해 주세요.");const r={';
  if(source.includes(saveOld)) source=source.replace(saveOld,saveNew);
  else if(!source.includes('자동 계산을 불러온 뒤 저장해 주세요.')) throw new Error(`save guard marker missing: ${path}`);

  fs.writeFileSync(path,source,'utf8');
}

const check=fs.readFileSync('src/rates.js','utf8');
for(const forbidden of ['function N(','function R(','function W(','function T(','function wbValidPublicSupport(','window.addEventListener("woongbi:quote-api-loaded",()=>ze())[I,K]']){
  if(check.includes(forbidden)) throw new Error(`forbidden public quote marker remains: ${forbidden}`);
}
for(const required of ['window.WoongbiQuoteApi?.getCurrent','window.WoongbiQuoteApi?.sync','l.quotePair','자동 계산을 불러온 뒤 저장해 주세요.','quote-api-loaded",()=>ze());[I,K].forEach']){
  if(!check.includes(required)) throw new Error(`required server quote marker missing: ${required}`);
}
console.log('server quote client handoff and save guards patched');
