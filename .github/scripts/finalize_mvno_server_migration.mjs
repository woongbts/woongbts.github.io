import fs from 'node:fs';

function replaceOnce(source,before,after,label){
  const at=source.indexOf(before);
  if(at<0)throw new Error(`${label} marker missing`);
  if(source.indexOf(before,at+before.length)>=0)throw new Error(`${label} marker duplicated`);
  return source.slice(0,at)+after+source.slice(at+before.length);
}

const path='.github/scripts/validate_site.py';
let s=fs.readFileSync(path,'utf8');
s=replaceOnce(
  s,
  'internet_ui = Path("assets/internet-ui.min.js").read_text(encoding="utf-8")\n',
  'internet_ui = Path("assets/internet-ui.min.js").read_text(encoding="utf-8")\nmvno_bridge = Path("assets/mvno-api-bridge.min.js").read_text(encoding="utf-8")\nmvno_display = Path("assets/mvno-display.js").read_text(encoding="utf-8")\n',
  'load MVNO server assets'
);
s=replaceOnce(
  s,
  'for marker in ("fallbackSettopFee", "internetDiscountBySpeed", "wbWiredPackageOverride", "SKB_TV_POP180:{100:30", "TV_SMART_PLUS:{100:29", "const Mt=t(\\\"internet-carrier\\\")"):\n    check(marker not in rates, f"public wired pricing logic returned: {marker}")\n',
  'for marker in ("fallbackSettopFee", "internetDiscountBySpeed", "wbWiredPackageOverride", "SKB_TV_POP180:{100:30", "TV_SMART_PLUS:{100:29", "const Mt=t(\\\"internet-carrier\\\")"):\n    check(marker not in rates, f"public wired pricing logic returned: {marker}")\n\n# MVNO assortment exclusions and store-curated picks are server-owned.\ncheck("/catalog/mvno" in mvno_bridge, "server MVNO catalog wiring missing")\ncheck("WoongbiMvnoApi" in mvno_bridge and "WoongbiMvnoApi" in rates, "MVNO server state bridge missing")\ncheck("mvno-api-bridge.min.js" in rates_html, "MVNO server bridge script missing")\ncheck(not Path("data/mvno-postpaid.json").exists(), "public MVNO source data returned")\nfor marker in ("MMOBILE-1295", "SKYLIFE-2069", "UPLUSE-2390", "SMKT", "IYAGISKT"):\n    check(marker not in mvno_display, f"public MVNO assortment policy returned: {marker}")\ncheck("data/mvno-postpaid.json" not in rates, "public MVNO JSON fetch returned")\n',
  'validate MVNO server contract'
);
s=replaceOnce(
  s,
  '    internet_bridge,\n    internet_ui,\n]).lower()',
  '    internet_bridge,\n    internet_ui,\n    mvno_bridge,\n    mvno_display,\n]).lower()',
  'include MVNO assets in public leak scan'
);
fs.writeFileSync(path,s,'utf8');
console.log('MVNO server validation added');
