from pathlib import Path
import re

js_path = Path('assets/rates.js')
html_path = Path('rates.html')

js = js_path.read_text(encoding='utf-8')
html = html_path.read_text(encoding='utf-8')

old = """  function fillInternetProducts(){
    const pid=internetCarrier.value,items=internetProducts().filter(p=>p.provider_id===pid).sort(byOrder);
    clearSelect(internetProduct,pid?'인터넷 상품을 선택하세요':'통신사를 먼저 선택하세요');
    items.forEach(p=>option(internetProduct,p.id,p.name));
    internetProduct.disabled=!pid||!items.length;
"""

new = """  function internetSpeedLabel(p){
    const mbps=Number(p?.speed_mbps);
    if(!Number.isFinite(mbps)||mbps<=0)return '';
    if(mbps>=1000){
      const gbps=mbps/1000;
      return `${Number.isInteger(gbps)?gbps:gbps.toFixed(1)}G`;
    }
    return `${mbps}M`;
  }
  function internetHasWifi(p){
    const name=String(p?.name||'').toLowerCase(),group=String(p?.product_group||'').toUpperCase();
    return group==='WIFI'||group==='WINGS'||name.includes('와이파이')||name.includes('wifi')||name.includes('wi-fi')||name.includes('윙즈');
  }
  function internetProductLabel(p){
    const name=String(p?.name||''),speed=internetSpeedLabel(p),wifi=internetHasWifi(p);
    const normalizedName=name.replace(/\\s+/g,'').toUpperCase();
    const normalizedSpeed=String(speed).replace(/\\s+/g,'').toUpperCase();
    const parts=[];
    if(speed&&!normalizedName.includes(normalizedSpeed))parts.push(speed);
    if(wifi)parts.push('와이파이 포함');
    return parts.length?`${name} (${parts.join(', ')})`:name;
  }
  function fillInternetProducts(){
    const pid=internetCarrier.value,items=internetProducts().filter(p=>p.provider_id===pid).sort(byOrder);
    clearSelect(internetProduct,pid?'인터넷 상품을 선택하세요':'통신사를 먼저 선택하세요');
    items.forEach(p=>option(internetProduct,p.id,internetProductLabel(p)));
    internetProduct.disabled=!pid||!items.length;
"""

if old not in js:
    raise SystemExit('fillInternetProducts anchor not found; aborting without changes')
js = js.replace(old, new, 1)

old_bits = """    const bits=[];if(p.speed_mbps)bits.push(`${p.speed_mbps}Mbps`);if(tvSelected&&tv?.name)bits.push(tv.name);if(tvSelected&&combo)bits.push('인터넷+TV 결합할인 자동 반영');if(wiredRule?.notes)bits.push(wiredRule.notes);if(mobileRule?.notes)bits.push(mobileRule.notes);
"""
new_bits = """    const bits=[],speedLabel=internetSpeedLabel(p);if(speedLabel)bits.push(`인터넷 속도 ${speedLabel}`);if(internetHasWifi(p))bits.push('와이파이 포함');if(tvSelected&&tv?.name)bits.push(tv.name);if(tvSelected&&combo)bits.push('인터넷+TV 결합할인 자동 반영');if(wiredRule?.notes)bits.push(wiredRule.notes);if(mobileRule?.notes)bits.push(mobileRule.notes);
"""
if old_bits not in js:
    raise SystemExit('internet detail anchor not found; aborting without changes')
js = js.replace(old_bits, new_bits, 1)

html2, count = re.subn(r'assets/rates\.js\?v=[^"\\s]+', 'assets/rates.js?v=20260916-4', html, count=1)
if count != 1:
    raise SystemExit('rates.js cache-buster anchor not found; aborting without changes')

js_path.write_text(js, encoding='utf-8')
html_path.write_text(html2, encoding='utf-8')

print('Updated Internet product dropdown labels with speed/Wi-Fi descriptions.')
