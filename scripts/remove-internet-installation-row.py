from pathlib import Path
import re

html_path = Path('rates.html')
js_path = Path('assets/rates.js')

html = html_path.read_text(encoding='utf-8')
js = js_path.read_text(encoding='utf-8')

old_row = '''                <div><span>설치비</span><b id="internet-installation">매장 확인</b></div>\n'''
if old_row not in html:
    raise SystemExit('installation row not found in rates.html')
html = html.replace(old_row, '', 1)

old_warning = '표시 금액은 등록된 3년 약정 기준입니다. 설치비·셋톱박스·공유기·추가 회선·프로모션에 따라 실제 청구액은 달라질 수 있습니다.'
new_warning = '표시 금액은 등록된 3년 약정 기준입니다. 셋톱박스·공유기·추가 회선·프로모션 등 최종 가입 조건에 따라 실제 청구액은 달라질 수 있습니다.'
if old_warning in html:
    html = html.replace(old_warning, new_warning, 1)

old_reset = "      $('internet-installation').textContent='매장 확인';\n"
if old_reset not in js:
    raise SystemExit('installation reset line not found in rates.js')
js = js.replace(old_reset, '', 1)

old_calc = '''    const installParts=[];\n    if(hasAmount(p.installation_fee))installParts.push(Number(p.installation_fee));else installParts.push(null);\n    if(tvSelected){\n      if(stb&&hasAmount(stb.installation_fee))installParts.push(Number(stb.installation_fee));\n      else if(tv&&hasAmount(tv.installation_fee)&&Number(tv.installation_fee)>0)installParts.push(Number(tv.installation_fee));\n      else installParts.push(null);\n    }\n    $('internet-installation').textContent=installParts.every(v=>v!==null)?won(installParts.reduce((a,b)=>a+b,0)):'매장 확인';\n\n'''
if old_calc not in js:
    raise SystemExit('installation calculation block not found in rates.js')
js = js.replace(old_calc, '', 1)

html, count = re.subn(r'assets/rates\.js\?v=[^"\\s]+', 'assets/rates.js?v=20260916-5', html, count=1)
if count != 1:
    raise SystemExit('rates.js cache-buster not found')

html_path.write_text(html, encoding='utf-8')
js_path.write_text(js, encoding='utf-8')
print('Removed customer-facing Internet installation fee row and JS calculation.')
