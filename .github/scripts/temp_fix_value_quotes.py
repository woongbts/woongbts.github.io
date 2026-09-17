from pathlib import Path
import json

js_path=Path('assets/rates.min.js')
s=js_path.read_text(encoding='utf-8')

old_note='value:"매장에서 실제로 자주 안내하는 갤럭시 Jump5·A37·퀀텀7의 기기변경 견적을 한눈에 비교합니다. 확인된 매장 견적을 기준으로 월 기기값과 통신요금을 함께 보여드립니다."'
new_note='value:"매장에서 실제로 자주 안내하는 갤럭시 Jump5·A37·퀀텀7의 번호이동 견적을 한눈에 비교합니다. 확인된 매장 견적을 기준으로 월 기기값과 통신요금을 함께 보여드립니다."'
assert s.count(old_note)==1, s.count(old_note)
s=s.replace(old_note,new_note,1)

old_entries='jump5:{category:"value",carrier:"KT",deviceId:"KT-XD-2895",name:"갤럭시 Jump5 5G",modelCode:"SM-A276K",price:545600,planName:"베이직 4GB",planFee:37e3,deviceMonthly:24160,installmentFee:34240,contractDiscount:9250,welfareAmount:0},a37:{category:"value",carrier:"KT",deviceId:"KT-XD-2893",name:"갤럭시 A37 5G",modelCode:"SM-A376NK",price:598400,planName:"베이직 4GB",planFee:37e3,deviceMonthly:26490,installmentFee:37360,contractDiscount:9250,welfareAmount:0},quantum7:{category:"value",carrier:"SKT",deviceId:"SKT-XD-2944",name:"갤럭시 퀀텀7",modelCode:"SM-A576S",price:717200,planName:"라이트 39",planFee:39e3,deviceMonthly:31750,installmentFee:44800,contractDiscount:9750,welfareAmount:0}'
new_entries='jump5:{category:"value",carrier:"KT",deviceId:"X-KT-2895",name:"갤럭시 Jump5 5G",modelCode:"SM-A276K",price:545600,planId:"X-KT-2605",planName:"베이직 4GB",planFee:37e3,joinLabel:"번호이동",method:"contract",deviceMonthly:24160,installmentFee:34240,principal:545600,contractDiscount:9250,support:0,serviceMonthly:27750,monthly:51910,welfareAmount:0},a37:{category:"value",carrier:"SKT",deviceId:"X-SKT-2892",name:"갤럭시 A37 5G",modelCode:"SM-A376N",price:598400,planId:"X-SKT-2945",planName:"라이트 39",planFee:39e3,joinLabel:"번호이동",method:"contract",deviceMonthly:26490,installmentFee:37360,principal:598400,contractDiscount:9750,support:0,serviceMonthly:29250,monthly:55740,welfareAmount:0},quantum7:{category:"value",carrier:"SKT",deviceId:"X-SKT-2944",name:"갤럭시 퀀텀7",modelCode:"SM-A576S",price:717200,planId:"X-SKT-2945",planName:"라이트 39",planFee:39e3,joinLabel:"번호이동",method:"support",deviceMonthly:23340,installmentFee:32960,principal:527200,contractDiscount:0,support:190000,serviceMonthly:39000,monthly:62340,welfareAmount:0}'
assert s.count(old_entries)==1, s.count(old_entries)
s=s.replace(old_entries,new_entries,1)

start=s.index('function ye(e,t=!1)')
end=s.index('function ge(e)',start)
old_ye=s[start:end]
new_ye='function ye(e,t=!1){const n=he[e];if(!n)return null;const o="stylefolder2"===e&&t?Number(n.welfareAmount||0):0,r=n.method||"contract",a=Math.max(0,null!=n.serviceMonthly?Number(n.serviceMonthly):Number(n.planFee)-Number(n.contractDiscount||0)-o),i=null!=n.monthly?Number(n.monthly):Number(n.deviceMonthly)+a,l=o>0?"basic_pension":"none",c=Math.max(0,null!=n.principal?Number(n.principal):"support"===r?Number(n.price)-Number(n.support||0):Number(n.price)),s=Math.max(0,Number(n.installmentFee||0)),u={known:!0,method:r,price:Number(n.price),planFee:Number(n.planFee),support:"support"===r?Number(n.support||0):0,contractDiscount:"contract"===r?Number(n.contractDiscount||0):0,principal:c,inst:{monthly:Number(n.deviceMonthly),total:c+s},service:a,welfare:{amount:o},monthly:i,total24:24*i};return{curated:!0,joinLabel:n.joinLabel||"기기변경",d:{id:n.deviceId,carrier:n.carrier,name:n.name,model_code:n.modelCode,retail_price:n.price},p:{id:n.planId||`curated-${e}`,carrier:n.carrier,name:n.planName,monthly_fee:n.planFee},best:u,support:"support"===r?u:{known:!1},contract:"contract"===r?u:{known:!1},welfare:l}}'
s=s[:start]+new_ye+s[end:]

old_value_gate='if("value"===ve)return function(e,t){return"기기변경"!==t?[]:["jump5","a37","quantum7"].map(e=>ye(e,!1)).filter(t=>t&&("all"===e||t.d.carrier===e))}(e,r);'
new_value_gate='if("value"===ve)return function(e,t){return"번호이동"!==t?[]:["jump5","a37","quantum7"].map(e=>ye(e,!1)).filter(t=>t&&("all"===e||t.d.carrier===e))}(e,r);'
assert s.count(old_value_gate)==1, s.count(old_value_gate)
s=s.replace(old_value_gate,new_value_gate,1)

old_auto='"kids"===ve&&t("purpose-join")&&"신규가입"!==t("purpose-join").value&&(t("purpose-join").value="신규가입");const i=Ke();'
new_auto='"kids"===ve&&t("purpose-join")&&"신규가입"!==t("purpose-join").value&&(t("purpose-join").value="신규가입"),"value"===ve&&t("purpose-join")&&"번호이동"!==t("purpose-join").value&&(t("purpose-join").value="번호이동");const i=Ke();'
assert s.count(old_auto)==1, s.count(old_auto)
s=s.replace(old_auto,new_auto,1)

old_support_render='"premium"===ve&&o.support?.known&&h.append(je("공시지원금","-"+e(o.support.support)),je("지원 후 기기값",e(o.support.principal)))'
new_support_render='("premium"===ve||"value"===ve)&&o.support?.known&&h.append(je("공시지원금","-"+e(o.support.support)),je("지원 후 기기값",e(o.support.principal)))'
assert s.count(old_support_render)==1, s.count(old_support_render)
s=s.replace(old_support_render,new_support_render,1)

scroll_fix=';(()=>{let e=null;const t=e=>e&&e.closest?e.closest(".plan-picker-sheet"):null;document.addEventListener("touchstart",n=>{document.body.classList.contains("plan-picker-opened")&&!t(n.target)&&(e=n.touches&&n.touches[0]?n.touches[0].clientY:null)},{passive:!0}),document.addEventListener("touchmove",n=>{if(null===e||!document.body.classList.contains("plan-picker-opened")||t(n.target))return;const o=n.touches&&n.touches[0]?n.touches[0].clientY:null;null!==o&&(window.scrollBy(0,e-o),e=o,n.cancelable&&n.preventDefault())},{passive:!1}),document.addEventListener("touchend",()=>{e=null},{passive:!0}),document.addEventListener("touchcancel",()=>{e=null},{passive:!0})})();'
assert scroll_fix not in s
s+=scroll_fix
js_path.write_text(s,encoding='utf-8')

html_path=Path('rates.html')
h=html_path.read_text(encoding='utf-8')
old_ver='assets/rates.min.js?v=20260917-2'
new_ver='assets/rates.min.js?v=20260918-1'
assert h.count(old_ver)==1, h.count(old_ver)
h=h.replace(old_ver,new_ver,1)
html_path.write_text(h,encoding='utf-8')

# Ground the curated IDs against the public catalog so the cards stay tied to real public records.
data=json.loads(Path('data/mobile-public.json').read_text(encoding='utf-8'))
devices={d['id']:d for d in data.get('devices',[])}
plans={p['id']:p for p in data.get('mobile_plans',[])}
assert devices['X-KT-2895']['carrier']=='KT' and devices['X-KT-2895']['retail_price']==545600
assert devices['X-SKT-2892']['carrier']=='SKT' and devices['X-SKT-2892']['retail_price']==598400
assert devices['X-SKT-2944']['carrier']=='SKT' and devices['X-SKT-2944']['retail_price']==717200
assert plans['X-KT-2605']['name']=='베이직 4GB' and plans['X-KT-2605']['monthly_fee']==37000
assert plans['X-SKT-2945']['name']=='라이트 39' and plans['X-SKT-2945']['monthly_fee']==39000
print('value quote patch applied')
