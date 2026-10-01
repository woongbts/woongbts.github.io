import fs from 'node:fs';

const paths = ['src/rates.js', 'assets/rates.min.js'];
const startMarker = 'function wbApplyStudyphoneSnapshot(e){';
const endMarker = '}function wbStudyphoneFail(){';
const replacement = 'function wbApplyStudyphoneSnapshot(snapshot){if(!snapshot?.device||!Array.isArray(snapshot?.items))throw Error("studyphone-api-invalid");const n=Je?.value||"";l={meta:snapshot.meta||{},device:snapshot.device,plans:snapshot.items.map(item=>item.plan).filter(Boolean)},h("studyphone-updated",l?.meta?.updated_at),Je&&(Je.innerHTML="",v(Je,"","요금제를 선택하세요"),(l.plans||[]).forEach(plan=>v(Je,plan.id,`${plan.name} · ${e(plan.monthly_fee)}`)),[...Je.options].some(option=>option.value===n)&&(Je.value=n)),nt(),tt(),document.documentElement.dataset.studyphoneUi="ready"';

for (const path of paths) {
  let source = fs.readFileSync(path, 'utf8');
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`studyphone snapshot markers missing in ${path}`);
  source = source.slice(0, start) + replacement + source.slice(end);
  if (source.includes('function wbApplyStudyphoneSnapshot(e){')) throw new Error(`shadowing parameter remains in ${path}`);
  if (!source.includes('function wbApplyStudyphoneSnapshot(snapshot){')) throw new Error(`fixed snapshot handler missing in ${path}`);
  fs.writeFileSync(path, source, 'utf8');
}

console.log('fixed studyphone snapshot formatter shadowing');
