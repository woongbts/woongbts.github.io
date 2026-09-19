from pathlib import Path

src = Path("src/rates.js")
out = Path("assets/rates.min.js")
css_path = Path("assets/rates.css")
html_path = Path("rates.html")
image_dir = Path("assets/device-images")

js = src.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")

image_files = {
    "Iphone17pro.png", "Iphone18pro.png", "galaxyS26ultra.png", "galaxya17.png",
    "galaxya36.png", "galaxya37.png", "galaxybuddy5.png", "galaxyjump5.png",
    "galaxys25edge.png", "galaxys25fe.png", "galaxys26.png", "galaxys26fe.png",
    "galaxys26plus.png", "galaxywide9.png", "galaxyzflip8.png", "galaxyzfold8(wide).png",
    "galaxyzfold8ultra.png", "iphone17.png", "iphone17e.png", "iphone17promax.png",
    "iphone18promax.png", "iphoneair.png", "motog77.png", "motog86power5g.png",
    "redminote14.png", "redminote14pro.png", "stylefolder2.png", "z2339k.png",
    "zempocket.png", "갤럭시퀀텀8.png", "공신폰.png",
}
missing = sorted(name for name in image_files if not (image_dir / name).exists())
if missing:
    raise SystemExit(f"missing uploaded device images: {missing}")

if "function wbDeviceImage(e)" not in js:
    marker = 'document.querySelectorAll(".rate-tab")'
    pos = js.find(marker)
    if pos < 0:
        raise SystemExit("rate-tab marker not found")
    helper = (
        'function wbDeviceImage(e){'
        'const t=`${e?.name||""} ${e?.manufacturer||""} ${e?.model||""} ${e?.model_code||""}`.toLowerCase().replace(/\\s+/g,"").replace(/\\+/g,"plus");'
        'let n="";'
        'if(/아이폰18promax|iphone18promax/.test(t))n="iphone18promax.png";'
        'else if(/아이폰18pro|iphone18pro/.test(t))n="Iphone18pro.png";'
        'else if(/아이폰air|iphoneair/.test(t))n="iphoneair.png";'
        'else if(/아이폰17promax|iphone17promax/.test(t))n="iphone17promax.png";'
        'else if(/아이폰17pro|iphone17pro/.test(t))n="Iphone17pro.png";'
        'else if(/아이폰17e|iphone17e/.test(t))n="iphone17e.png";'
        'else if(/아이폰17|iphone17/.test(t))n="iphone17.png";'
        'else if(/갤럭시s26ultra|galaxys26ultra|s26ultra/.test(t))n="galaxyS26ultra.png";'
        'else if(/갤럭시s26plus|galaxys26plus|s26plus/.test(t))n="galaxys26plus.png";'
        'else if(/갤럭시s26fe|galaxys26fe|s26fe/.test(t))n="galaxys26fe.png";'
        'else if(/갤럭시s26|galaxys26/.test(t))n="galaxys26.png";'
        'else if(/갤럭시s25edge|galaxys25edge|s25edge/.test(t))n="galaxys25edge.png";'
        'else if(/갤럭시s25fe|galaxys25fe|s25fe/.test(t))n="galaxys25fe.png";'
        'else if(/zfold8ultra|폴드8ultra|fold8ultra/.test(t))n="galaxyzfold8ultra.png";'
        'else if(/zfold8|폴드8|fold8/.test(t))n="galaxyzfold8(wide).png";'
        'else if(/zflip8|플립8|flip8/.test(t))n="galaxyzflip8.png";'
        'else if(/갤럭시a37|galaxya37|sm-a376/.test(t))n="galaxya37.png";'
        'else if(/갤럭시a36|galaxya36|sm-a366/.test(t))n="galaxya36.png";'
        'else if(/갤럭시a17|galaxya17|sm-a175/.test(t))n="galaxya17.png";'
        'else if(/buddy5|버디5/.test(t))n="galaxybuddy5.png";'
        'else if(/jump5|점프5/.test(t))n="galaxyjump5.png";'
        'else if(/wide9|와이드9/.test(t))n="galaxywide9.png";'
        'else if(/quantum8|퀀텀8/.test(t))n="갤럭시퀀텀8.png";'
        'else if(/motog86power|g86power/.test(t))n="motog86power5g.png";'
        'else if(/motog77|g77/.test(t))n="motog77.png";'
        'else if(/redminote14pro|홍미노트14pro/.test(t))n="redminote14pro.png";'
        'else if(/redminote14|홍미노트14/.test(t))n="redminote14.png";'
        'else if(/스타일폴더2|stylefolder2|at-m140/.test(t))n="stylefolder2.png";'
        'else if(/z2339k/.test(t))n="z2339k.png";'
        'else if(/zem폰|zemphone|포켓피스|pocketpiece/.test(t))n="zempocket.png";'
        'else if(/공신폰/.test(t))n="공신폰.png";'
        'return n?`assets/device-images/${encodeURIComponent(n)}`:""'
        '}'
    )
    js = js[:pos] + helper + js[pos:]

quick_old = '</small>`;const btn=document.createElement("button");btn.type="button",btn.textContent="이 조건으로 자세히 계산"'
quick_new = '</small>`;const image=wbDeviceImage(d);if(image){const frame=document.createElement("div"),img=document.createElement("img");frame.className="device-card-image quick-device-image",img.src=image,img.alt=d.name||"휴대폰",img.loading="lazy",img.decoding="async",frame.appendChild(img),card.querySelector(".quick-result-badge")?.after(frame)}const btn=document.createElement("button");btn.type="button",btn.textContent="이 조건으로 자세히 계산"'
if quick_old in js:
    if js.count(quick_old) != 1:
        raise SystemExit(f"unexpected quick card insertion count: {js.count(quick_old)}")
    js = js.replace(quick_old, quick_new, 1)
elif 'quick-device-image' not in js:
    raise SystemExit("quick recommendation card marker not found")

purpose_old = 'i.append(l,c);const s=document.createElement("strong");s.textContent=o.d.name;'
purpose_new = 'i.append(l,c);const s=document.createElement("strong");s.textContent=o.d.name;const image=wbDeviceImage(o.d),imageFrame=image?document.createElement("div"):null;if(imageFrame){const img=document.createElement("img");imageFrame.className="device-card-image purpose-device-image",img.src=image,img.alt=o.d.name||"휴대폰",img.loading="lazy",img.decoding="async",imageFrame.appendChild(img)}'
if purpose_old in js:
    if js.count(purpose_old) != 1:
        raise SystemExit(f"unexpected purpose card marker count: {js.count(purpose_old)}")
    js = js.replace(purpose_old, purpose_new, 1)
elif 'purpose-device-image' not in js:
    raise SystemExit("purpose recommendation card marker not found")

append_old = 'a.append(i,s),"premium"===ve&&u.textContent&&a.append(u),a.append(d),'
append_new = 'a.append(i),imageFrame&&a.append(imageFrame),a.append(s),"premium"===ve&&u.textContent&&a.append(u),a.append(d),'
if append_old in js:
    if js.count(append_old) != 1:
        raise SystemExit(f"unexpected purpose append count: {js.count(append_old)}")
    js = js.replace(append_old, append_new, 1)
elif append_new not in js:
    raise SystemExit("purpose append marker not found")

for required in ["function wbDeviceImage(e)", "quick-device-image", "purpose-device-image", 'img.loading="lazy"']:
    if required not in js:
        raise SystemExit(f"device image integration missing: {required}")

src.write_text(js.rstrip() + "\n", encoding="utf-8")
out.write_text(js.rstrip() + "\n", encoding="utf-8")

css_marker = "/* Device images in recommendation cards */"
css_block = '''\n\n/* Device images in recommendation cards */\n.device-card-image{height:150px;margin:8px 0 12px;padding:8px;border-radius:14px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#f8fbfb}\n.device-card-image img{display:block;width:100%;height:100%;object-fit:contain}\n.quick-result-card .quick-device-image{height:150px}\n.purpose-card .purpose-device-image{height:145px}\n@media(max-width:760px){.device-card-image,.quick-result-card .quick-device-image,.purpose-card .purpose-device-image{height:132px;margin:6px 0 10px}}\n'''
if css_marker not in css:
    css = css.rstrip() + css_block
css_path.write_text(css.rstrip() + "\n", encoding="utf-8")

for old, new in [
    ('assets/rates.css?v=20260918-5', 'assets/rates.css?v=20260919-1'),
    ('assets/rates.min.js?v=20260919-4', 'assets/rates.min.js?v=20260919-5'),
]:
    if old in html:
        html = html.replace(old, new, 1)
    elif new not in html:
        raise SystemExit(f"cache marker not found: {old}")
html_path.write_text(html, encoding="utf-8")

print("device image integration applied")
