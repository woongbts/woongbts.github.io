import fs from 'node:fs';

const paths=['src/rates.js','assets/rates.min.js'];

for(const path of paths){
  let source=fs.readFileSync(path,'utf8');

  // Remove public provider discount and gift matrices.
  const tableStart=source.indexOf('const u={SKB:');
  const tableEnd=source.indexOf(',m=(e,t)=>',tableStart);
  if(tableStart<0||tableEnd<0)throw new Error(`wired pricing tables not found in ${path}`);
  source=source.slice(0,tableStart)+'const m=(e,t)=>'+source.slice(tableEnd+',m=(e,t)=>'.length);

  // Remove the entire browser-owned wired calculator. A standalone UI-only bridge owns this panel now.
  const wiredStart=source.indexOf('const Mt=t("internet-carrier")');
  const wiredEnd=source.indexOf('wbLoadStudyphone(),Promise.all(',wiredStart);
  if(wiredStart<0||wiredEnd<0)throw new Error(`wired calculator block markers missing in ${path}`);
  source=source.slice(0,wiredStart)+'wbLoadStudyphone(),Promise.all('+source.slice(wiredEnd+'wbLoadStudyphone(),Promise.all('.length);

  // Do not fetch public wired pricing data from GitHub Pages.
  const internetFetch='fetch("data/internet.json?v=20260922-2").then(e=>e.json())';
  if(!source.includes(internetFetch))throw new Error(`internet fetch marker missing in ${path}`);
  source=source.replace(internetFetch,'Promise.resolve(null)');
  source=source.replace(',h("internet-updated",s?.meta?.updated_at)','');

  // Remove old wired initialization / URL restore that depended on local pricing data.
  const initStart=source.indexOf(',f(Mt,"통신사를 선택하세요")');
  const initEndMarker='}();Re();const E=!$&&function()';
  const initEnd=source.indexOf(initEndMarker,initStart);
  if(initStart<0||initEnd<0)throw new Error(`wired init markers missing in ${path}`);
  source=source.slice(0,initStart)+',Fe();Re();const E=function()'+source.slice(initEnd+initEndMarker.length);
  if(!source.includes('$||E||Be("purpose")'))throw new Error(`wired restore tail marker missing in ${path}`);
  source=source.replace('$||E||Be("purpose")','E||Be("purpose")');

  for(const forbidden of [
    'fallbackSettopFee',
    'internetDiscountBySpeed',
    'wbWiredPackageOverride',
    'SKB_TV_POP180:{100:30',
    'TV_SMART_PLUS:{100:29',
    'data/internet.json',
    'const Mt=t("internet-carrier")',
  ]) if(source.includes(forbidden)) throw new Error(`public wired marker remains in ${path}: ${forbidden}`);

  fs.writeFileSync(path,source,'utf8');
}
console.log('removed public internet/TV pricing engine; standalone UI will use server API');
