from pathlib import Path
import re

src_path = Path('src/rates.js')
prod_path = Path('assets/rates.min.js')
engine_path = Path('assets/recommendation-engine-v2.js')
pwa_path = Path('assets/pwa.min.js')
rates_html_path = Path('rates.html')
sw_path = Path('sw.js')

src = src_path.read_text(encoding='utf-8')
engine = engine_path.read_text(encoding='utf-8')
pwa = pwa_path.read_text(encoding='utf-8')
rates_html = rates_html_path.read_text(encoding='utf-8')
sw = sw_path.read_text(encoding='utf-8')

# Keep one carrier-independent model -> image mapping and make it reusable.
expose_old = 'return n?`assets/device-images/${encodeURIComponent(n)}`:""}document.querySelectorAll'
expose_new = 'return n?`assets/device-images/${encodeURIComponent(n)}`:""}window.woongbiDeviceImage=wbDeviceImage;document.querySelectorAll'
if expose_old in src:
    src = src.replace(expose_old, expose_new, 1)
elif 'window.woongbiDeviceImage=wbDeviceImage' not in src:
    raise SystemExit('could not expose shared device image resolver')

# Recommendation engine v2 re-renders purpose cards, so it must use the same resolver.
helper_marker = "  function brand(d){"
helper_code = "  function deviceImage(d){return typeof window.woongbiDeviceImage==='function'?window.woongbiDeviceImage(d):''}\n"
if 'function deviceImage(d)' not in engine:
    if helper_marker not in engine:
        raise SystemExit('engine helper insertion marker missing')
    engine = engine.replace(helper_marker, helper_code + helper_marker, 1)

card_old = "const title=document.createElement('strong');title.textContent=c.d.name;const plan=document.createElement('em');"
card_new = "const title=document.createElement('strong');title.textContent=c.d.name;const image=deviceImage(c.d),imageFrame=image?document.createElement('div'):null;if(imageFrame){const img=document.createElement('img');imageFrame.className='device-card-image purpose-device-image wb-v2-device-image';img.src=image;img.alt=c.d.name||'휴대폰';img.loading='lazy';img.decoding='async';img.addEventListener('error',()=>imageFrame.remove(),{once:true});imageFrame.appendChild(img)}const plan=document.createElement('em');"
if card_old in engine:
    engine = engine.replace(card_old, card_new, 1)
elif 'wb-v2-device-image' not in engine:
    raise SystemExit('engine card image insertion marker missing')

append_old = "a.append(top,title,plan,kicker,total,details,specs,cmp,why,actions);return a}"
append_new = "a.append(top);if(imageFrame)a.append(imageFrame);a.append(title,plan,kicker,total,details,specs,cmp,why,actions);return a}"
if append_old in engine:
    engine = engine.replace(append_old, append_new, 1)
elif append_new not in engine:
    raise SystemExit('engine card append marker missing')

# Cache-bust the engine and calculator script.
pwa_old = '/assets/recommendation-engine-v2.js?v=20260918-1'
pwa_new = '/assets/recommendation-engine-v2.js?v=20260919-2'
if pwa_old in pwa:
    pwa = pwa.replace(pwa_old, pwa_new, 1)
elif pwa_new not in pwa:
    raise SystemExit('pwa recommendation engine version marker missing')

for old, new in [
    ('assets/rates.min.js?v=20260919-5', 'assets/rates.min.js?v=20260919-6'),
    ('/assets/pwa.min.js?v=20260918-1', '/assets/pwa.min.js?v=20260919-2'),
]:
    if old in rates_html:
        rates_html = rates_html.replace(old, new, 1)
    elif new not in rates_html:
        raise SystemExit(f'rates.html cache marker missing: {old}')

# Make frequently changing calculator JS network-first so in-app browsers do not keep an old renderer.
sw_new = '''const CACHE="woongbi-pwa-20260919-3";const CORE=["/","/index.html","/rates.html","/offline.html","/assets/woongbi-mark.svg"];self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("woongbi-pwa-")&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});async function networkFirst(req,fallback){try{const res=await fetch(req,{cache:"no-cache"});const c=await caches.open(CACHE);res.ok&&c.put(req,res.clone());return res}catch(e){return(await caches.match(req))||(fallback?await caches.match(fallback):Response.error())}}async function stale(req){const c=await caches.open(CACHE),hit=await c.match(req);const update=fetch(req).then(res=>{res.ok&&c.put(req,res.clone());return res}).catch(()=>null);return hit||await update||Response.error()}self.addEventListener("fetch",e=>{const req=e.request;if(req.method!=="GET")return;const url=new URL(req.url);if(url.origin!==self.location.origin)return;if(req.mode==="navigate")return e.respondWith(networkFirst(req,"/offline.html"));if(url.pathname.startsWith("/data/"))return e.respondWith(networkFirst(req));if(["/assets/rates.min.js","/assets/recommendation-engine-v2.js","/assets/pwa.min.js"].includes(url.pathname))return e.respondWith(networkFirst(req));if(/\\.(?:css|js|svg|png|jpg|jpeg|webp)$/i.test(url.pathname))return e.respondWith(stale(req))});\n'''
sw = sw_new

# Canonical/production calculator source must stay identical.
src = src.rstrip() + '\n'
src_path.write_text(src, encoding='utf-8')
prod_path.write_text(src, encoding='utf-8')
engine_path.write_text(engine.rstrip() + '\n', encoding='utf-8')
pwa_path.write_text(pwa.rstrip() + '\n', encoding='utf-8')
rates_html_path.write_text(rates_html, encoding='utf-8')
sw_path.write_text(sw, encoding='utf-8')

# Safety assertions.
assert 'window.woongbiDeviceImage=wbDeviceImage' in src
assert "function deviceImage(d)" in engine
assert 'wb-v2-device-image' in engine
assert 'a.append(top);if(imageFrame)a.append(imageFrame);' in engine
assert pwa_new in pwa
assert 'assets/rates.min.js?v=20260919-6' in rates_html
assert '/assets/pwa.min.js?v=20260919-2' in rates_html
assert 'woongbi-pwa-20260919-3' in sw
print('purpose recommendation device images fixed')
