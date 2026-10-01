import fs from 'node:fs';

function replaceOnce(source,before,after,label){
  const at=source.indexOf(before);
  if(at<0)throw new Error(`${label} marker missing`);
  if(source.indexOf(before,at+before.length)>=0)throw new Error(`${label} marker duplicated`);
  return source.slice(0,at)+after+source.slice(at+before.length);
}

// Wire the server API before the main calculator and load the standalone wired UI after it.
{
  const path='rates.html';
  let s=fs.readFileSync(path,'utf8');
  const before='<script src="/assets/mvno-display.js?v=20260930-7" defer></script><script src="/assets/studyphone-api-bridge.min.js?v=20261001-1" defer></script><script src="assets/rates.min.js?v=20261001-9" defer></script>';
  const after='<script src="/assets/mvno-display.js?v=20260930-7" defer></script><script src="/assets/studyphone-api-bridge.min.js?v=20261001-1" defer></script><script src="/assets/internet-api-bridge.min.js?v=20261001-1" defer></script><script src="assets/rates.min.js?v=20261001-10" defer></script><script src="/assets/internet-ui.min.js?v=20261001-1" defer></script>';
  s=replaceOnce(s,before,after,'rates wired server scripts');
  fs.writeFileSync(path,s,'utf8');
}

// Remove public wired JSON from the service-worker data path and keep the new client bridge network-first.
{
  const path='sw.js';
  let s=fs.readFileSync(path,'utf8');
  s=replaceOnce(s,'const CACHE="woongbi-pwa-20261001-2"','const CACHE="woongbi-pwa-20261001-3"','PWA cache version');
  s=replaceOnce(s,',"/data/internet.json":{tab:"internet",empty:{meta:{},providers:[],internet_products:[],tv_products:[],settop_products:[],bundle_rules:[],multi_tv_package_totals:[]}}','', 'remove wired public data cache');
  s=replaceOnce(s,'"/assets/studyphone-api-bridge.min.js","/assets/quote-handoff.js"','"/assets/studyphone-api-bridge.min.js","/assets/internet-api-bridge.min.js","/assets/internet-ui.min.js","/assets/quote-handoff.js"','PWA wired bridges');
  fs.writeFileSync(path,s,'utf8');
}

// Permanent source-level guard: public wired pricing tables/data must never return.
{
  const path='.github/scripts/validate_site.py';
  let s=fs.readFileSync(path,'utf8');
  s=replaceOnce(s,
    'studyphone_bridge = Path("assets/studyphone-api-bridge.min.js").read_text(encoding="utf-8")\n',
    'studyphone_bridge = Path("assets/studyphone-api-bridge.min.js").read_text(encoding="utf-8")\ninternet_bridge = Path("assets/internet-api-bridge.min.js").read_text(encoding="utf-8")\ninternet_ui = Path("assets/internet-ui.min.js").read_text(encoding="utf-8")\n',
    'load wired server assets');
  s=replaceOnce(s,
    'for marker in ("installment_apr", "public_support", "function Qe(e){const t=l?.device", "Math.pow(1+o,t)"):\n    check(marker not in rates, f"public studyphone quote logic returned: {marker}")\n',
    'for marker in ("installment_apr", "public_support", "function Qe(e){const t=l?.device", "Math.pow(1+o,t)"):\n    check(marker not in rates, f"public studyphone quote logic returned: {marker}")\n\n# Internet/TV pricing, bundle rules, extra-TV formulas and gift matrices are server-owned.\ncheck("/quote/internet" in internet_bridge, "server internet quote wiring missing")\ncheck("WoongbiInternetApi" in internet_bridge and "WoongbiInternetApi" in internet_ui, "internet server state bridge missing")\ncheck("internet-api-bridge.min.js" in rates_html and "internet-ui.min.js" in rates_html, "internet server scripts missing")\ncheck(not Path("data/internet.json").exists(), "public internet pricing data returned")\nfor marker in ("fallbackSettopFee", "internetDiscountBySpeed", "wbWiredPackageOverride", "SKB_TV_POP180:{100:30", "TV_SMART_PLUS:{100:29", "const Mt=t(\\\"internet-carrier\\\")"):\n    check(marker not in rates, f"public wired pricing logic returned: {marker}")\n',
    'validate wired server contract');
  s=replaceOnce(s,
    '    studyphone_bridge,\n]).lower()',
    '    studyphone_bridge,\n    internet_bridge,\n    internet_ui,\n]).lower()',
    'include wired server assets in leak scan');
  fs.writeFileSync(path,s,'utf8');
}

if(!fs.existsSync('data/internet.json'))throw new Error('public internet data already missing before finalizer');
fs.unlinkSync('data/internet.json');

for(const path of ['src/rates.js','assets/rates.min.js']){
  const s=fs.readFileSync(path,'utf8');
  for(const marker of ['fallbackSettopFee','internetDiscountBySpeed','wbWiredPackageOverride','SKB_TV_POP180:{100:30','TV_SMART_PLUS:{100:29','data/internet.json','const Mt=t("internet-carrier")']){
    if(s.includes(marker))throw new Error(`public wired marker remains in ${path}: ${marker}`);
  }
}
console.log('internet and TV server migration finalized');
