import fs from 'node:fs';

const sourcePath = 'src/rates.js';
const assetPath = 'assets/rates.min.js';
let source = fs.readFileSync(sourcePath, 'utf8');
const before = source.length;

const purposeStartMarker = 'let ve="senior";const fe=';
const purposeEndMarker = 'function Be(e){';
const purposeStart = source.indexOf(purposeStartMarker);
const purposeEnd = source.indexOf(purposeEndMarker, purposeStart);
if (purposeStart < 0 || purposeEnd < 0 || purposeEnd <= purposeStart) {
  throw new Error('legacy purpose recommendation block markers not found');
}

const purposeShell = `let ve="senior";function Fe(){const e=t("purpose-results"),n=t("purpose-pension-wrap"),o=t("purpose-join");if(!e)return;n&&(n.hidden="senior"!==ve),document.querySelectorAll("[data-purpose-category]").forEach(e=>e.classList.toggle("active",e.dataset.purposeCategory===ve)),"kids"===ve&&o&&"신규가입"!==o.value&&(o.value="신규가입"),"value"===ve&&o&&"번호이동"!==o.value&&(o.value="번호이동"),e.innerHTML="<p>추천 조건을 불러오는 중입니다.</p>"}`;
source = source.slice(0, purposeStart) + purposeShell + source.slice(purposeEnd);

const quickStartMarker = 't("quick-find")?.addEventListener("click",function(){';
const quickEndMarker = '}),["quick-carrier","quick-join","quick-brand","quick-budget"].forEach';
const quickStart = source.indexOf(quickStartMarker);
const quickEnd = source.indexOf(quickEndMarker, quickStart);
if (quickStart < 0 || quickEnd < 0 || quickEnd <= quickStart) {
  throw new Error('legacy quick recommendation block markers not found');
}
const quickShell = 't("quick-find")?.addEventListener("click",function(){const e=t("quick-results");e&&(e.innerHTML="<p>추천 조건을 불러오는 중입니다.</p>")';
source = source.slice(0, quickStart) + quickShell + source.slice(quickEnd);

const forbidden = [
  'const fe={senior:',
  'jump5:{category:"value"',
  'function Ke(){',
  'function Ve(e){',
  'profiles={light:{min:3e4',
  'const devices=(o?.devices||[]).filter(e=>e.carrier===carrier&&V(e,brand)',
];
for (const marker of forbidden) {
  if (source.includes(marker)) throw new Error(`legacy recommendation marker remains: ${marker}`);
}
if (!source.includes('function Be(e){')) throw new Error('mobile mode shell missing after transform');
if (!source.includes('function ze(){')) throw new Error('direct calculator UI missing after transform');
if (!source.includes('const Et=t("prepaid-provider")')) throw new Error('prepaid UI missing after transform');
if (!source.includes('const Mt=t("internet-carrier")')) throw new Error('internet UI missing after transform');

fs.writeFileSync(sourcePath, source, 'utf8');
fs.writeFileSync(assetPath, source, 'utf8');
console.log(`legacy recommendation logic stripped: ${before - source.length} bytes removed; ${source.length} bytes remain`);
