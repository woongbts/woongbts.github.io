import fs from 'node:fs';

function replaceOnce(source, before, after, label) {
  const at=source.indexOf(before);
  if(at<0) throw new Error(`${label} marker missing`);
  if(source.indexOf(before,at+before.length)>=0) throw new Error(`${label} marker duplicated`);
  return source.slice(0,at)+after+source.slice(at+before.length);
}

// Wire the studyphone API bridge before the calculator bundle.
{
  const path='rates.html';
  let s=fs.readFileSync(path,'utf8');
  const before='<script src="/assets/mvno-display.js?v=20260930-7" defer></script><script src="assets/rates.min.js?v=20260930-8" defer></script>';
  const after='<script src="/assets/mvno-display.js?v=20260930-7" defer></script><script src="/assets/studyphone-api-bridge.min.js?v=20261001-1" defer></script><script src="assets/rates.min.js?v=20261001-9" defer></script>';
  s=replaceOnce(s,before,after,'rates studyphone bridge');
  fs.writeFileSync(path,s,'utf8');
}

// Treat the bridge as a quote-critical network-first asset and rotate the PWA cache.
{
  const path='sw.js';
  let s=fs.readFileSync(path,'utf8');
  s=replaceOnce(s,'const CACHE="woongbi-pwa-20261001-1"','const CACHE="woongbi-pwa-20261001-2"','PWA cache version');
  s=replaceOnce(s,'"/assets/quote-api-bridge.min.js","/assets/recommend-api-bridge.min.js"','"/assets/quote-api-bridge.min.js","/assets/recommend-api-bridge.min.js","/assets/studyphone-api-bridge.min.js"','PWA studyphone bridge');
  fs.writeFileSync(path,s,'utf8');
}

// Permanently validate that public studyphone pricing math/data do not return.
{
  const path='.github/scripts/validate_site.py';
  let s=fs.readFileSync(path,'utf8');
  s=replaceOnce(s,
    'quote_bridge = Path("assets/quote-api-bridge.min.js").read_text(encoding="utf-8")\n',
    'quote_bridge = Path("assets/quote-api-bridge.min.js").read_text(encoding="utf-8")\nstudyphone_bridge = Path("assets/studyphone-api-bridge.min.js").read_text(encoding="utf-8")\n',
    'validate studyphone bridge load');
  s=replaceOnce(s,
    'check("/quote/mobile" in quote_bridge, "server mobile quote wiring missing")\n',
    'check("/quote/mobile" in quote_bridge, "server mobile quote wiring missing")\ncheck("/quote/studyphone" in studyphone_bridge, "server studyphone quote wiring missing")\ncheck("WoongbiStudyphoneApi" in studyphone_bridge, "studyphone server state bridge missing")\ncheck("studyphone-api-bridge.min.js" in rates_html, "studyphone API bridge script missing")\ncheck(not Path("data/studyphone.json").exists(), "public studyphone pricing data returned")\nfor marker in ("installment_apr", "public_support", "function Qe(e){const t=l?.device", "Math.pow(1+o,t)"):\n    check(marker not in rates, f"public studyphone quote logic returned: {marker}")\n',
    'validate studyphone server contract');
  s=replaceOnce(s,
    '    quote_bridge,\n]).lower()',
    '    quote_bridge,\n    studyphone_bridge,\n]).lower()',
    'validate public studyphone text');
  fs.writeFileSync(path,s,'utf8');
}

// CI guard for the bridge, deleted static pricing file, and removed formulas.
{
  const path='.github/workflows/site-regression.yml';
  let s=fs.readFileSync(path,'utf8');
  s=replaceOnce(s,
    '          node --check assets/quote-api-bridge.min.js\n          node --check assets/recommend-api-bridge.min.js\n',
    '          node --check assets/quote-api-bridge.min.js\n          node --check assets/recommend-api-bridge.min.js\n          node --check assets/studyphone-api-bridge.min.js\n',
    'CI studyphone bridge check');
  s=replaceOnce(s,
    "          grep -q 'aria-pressed' assets/recommend-api-bridge.min.js\n",
    "          grep -q 'aria-pressed' assets/recommend-api-bridge.min.js\n          grep -q '/quote/studyphone' assets/studyphone-api-bridge.min.js\n          grep -q 'WoongbiStudyphoneApi' assets/studyphone-api-bridge.min.js\n          test ! -e data/studyphone.json\n          ! grep -q 'installment_apr' src/rates.js\n          ! grep -q 'public_support' src/rates.js\n          ! grep -q 'function Qe(e){const t=l?.device' src/rates.js\n          ! grep -q 'Math.pow(1+o,t)' src/rates.js\n",
    'CI studyphone hardening guards');
  fs.writeFileSync(path,s,'utf8');
}

if(!fs.existsSync('data/studyphone.json')) throw new Error('studyphone static data already missing before finalizer');
fs.unlinkSync('data/studyphone.json');

for(const path of ['src/rates.js','assets/rates.min.js']){
  const s=fs.readFileSync(path,'utf8');
  for(const marker of ['data/studyphone.json','installment_apr','public_support','function Qe(e){const t=l?.device','Math.pow(1+o,t)']){
    if(s.includes(marker)) throw new Error(`studyphone public marker remains in ${path}: ${marker}`);
  }
}
console.log('studyphone server migration finalized');
