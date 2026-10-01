import fs from 'node:fs';

function replaceOnce(source, before, after, label) {
  const at = source.indexOf(before);
  if (at < 0) throw new Error(`${label} marker missing`);
  if (source.indexOf(before, at + before.length) >= 0) throw new Error(`${label} marker duplicated`);
  return source.slice(0, at) + after + source.slice(at + before.length);
}

for (const path of ['src/rates.js', 'assets/rates.min.js']) {
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOnce(
    source,
    'fetch("data/mvno-postpaid.json?v=20260930-7").then(e=>e.json())',
    'window.WoongbiMvnoApi?.loadCatalog?.()||Promise.resolve({meta:{},providers:[],plans:[],groups:[],recommendations:{}})',
    `${path} MVNO public fetch`
  );
  if (source.includes('data/mvno-postpaid.json')) throw new Error(`public MVNO data fetch remains in ${path}`);
  if (!source.includes('WoongbiMvnoApi?.loadCatalog')) throw new Error(`MVNO API load missing in ${path}`);
  fs.writeFileSync(path, source, 'utf8');
}

{
  const path = 'rates.html';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOnce(
    source,
    '<script src="/assets/plan-eligibility.js?v=20260930-3" defer></script>\n<script src="/assets/mvno-display.js?v=20260930-7" defer></script>',
    '<script src="/assets/plan-eligibility.js?v=20260930-3" defer></script>\n<script src="/assets/mvno-api-bridge.min.js?v=20261001-1" defer></script><script src="/assets/mvno-display.js?v=20261001-1" defer></script>',
    'MVNO script wiring'
  );
  source = replaceOnce(source, 'assets/rates.min.js?v=20261001-10', 'assets/rates.min.js?v=20261001-11', 'rates asset version');
  fs.writeFileSync(path, source, 'utf8');
}

{
  const path = 'sw.js';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOnce(source, 'const CACHE="woongbi-pwa-20261001-3"', 'const CACHE="woongbi-pwa-20261001-4"', 'PWA cache version');
  source = replaceOnce(
    source,
    'const LAZY_DATA={"/data/mvno-postpaid.json":{tab:"mvno",empty:{meta:{},providers:[],plans:[]}},"/data/prepaid.json":{tab:"prepaid",empty:{meta:{},providers:[],plans:[]}}}',
    'const LAZY_DATA={"/data/prepaid.json":{tab:"prepaid",empty:{meta:{},providers:[],plans:[]}}}',
    'PWA MVNO public data cache'
  );
  source = replaceOnce(
    source,
    '"/assets/studyphone-api-bridge.min.js"',
    '"/assets/mvno-api-bridge.min.js","/assets/studyphone-api-bridge.min.js"',
    'PWA MVNO API bridge'
  );
  if (source.includes('/data/mvno-postpaid.json')) throw new Error('MVNO public data remains in service worker');
  fs.writeFileSync(path, source, 'utf8');
}

if (!fs.existsSync('data/mvno-postpaid.json')) throw new Error('MVNO public data already missing before migration');
fs.unlinkSync('data/mvno-postpaid.json');

console.log('MVNO assortment moved behind server API');
