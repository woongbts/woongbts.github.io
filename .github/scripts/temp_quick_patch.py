from pathlib import Path
import re

# Quick recommendation UI
hp=Path('rates.html')
h=hp.read_text(encoding='utf-8')
start=h.index('<section class="quick-recommend" id="quick-recommend" hidden>')
end=h.index('</section>', start)+len('</section>')
new_section='''<section class="quick-recommend" id="quick-recommend" hidden>
  <div class="quick-title"><div><strong>내 조건으로 3가지 비교</strong><span>통신사·가입유형·브랜드와 원하는 월 부담만 고르면, 가능한 기종·요금제·공시지원/선택약정을 함께 계산해 성격이 다른 3개 조합을 보여드립니다.</span></div></div>
  <div class="quick-fields">
    <label>통신사<select id="quick-carrier"><option>SKT</option><option>KT</option><option>LGU+</option></select></label>
    <label>가입유형<select id="quick-join"><option>기기변경</option><option>번호이동</option><option>신규가입</option></select></label>
    <label>선호 브랜드<select id="quick-brand"><option value="all">상관없음</option><option value="samsung">삼성 갤럭시</option><option value="apple">애플 아이폰</option><option value="other">기타 제조사</option></select></label>
    <label>원하는 월 부담<select id="quick-budget"><option value="light" selected>월 부담 가볍게 · 3~4만원대</option><option value="practical">실속 있게 · 5~6만원대</option><option value="balanced">기기·요금 균형 · 7~9만원대</option><option value="premium">좋은 기종 우선 · 10만원 안팎</option><option value="any">가격 상관없이 비교</option></select></label>
  </div>
  <div class="quick-budget-note" id="quick-budget-note">3~4만원대를 중심으로 보고, 정확히 맞는 조합이 부족하면 가장 가까운 조건까지 함께 비교합니다.</div>
  <button type="button" class="quick-find" id="quick-find">부담 맞춰 3가지 비교</button>
  <div class="quick-results" id="quick-results"><p>월 부담대를 고른 뒤 비교를 눌러주세요.</p></div>
</section>'''
h=h[:start]+new_section+h[end:]
h=re.sub(r'assets/rates\.css\?v=[^"\']+','assets/rates.css?v=20260918-5',h,count=1)
h=re.sub(r'assets/rates\.min\.js\?v=[^"\']+','assets/rates.min.js?v=20260918-9',h,count=1)
hp.write_text(h,encoding='utf-8')

# Smart recommendation engine
sp=Path('src/rates.js')
s=sp.read_text(encoding='utf-8')
start=s.index('t("quick-find")?.addEventListener("click",function(){')
end=s.index(',["device-compare-2","device-compare-3"].forEach',start)
new_logic=r'''t("quick-find")?.addEventListener("click",function(){
const result=t("quick-results"),carrier=t("quick-carrier").value,join=t("quick-join").value,brand=t("quick-brand").value,budgetKey=t("quick-budget").value||"light",profiles={light:{min:3e4,max:49999,target:4.2e4,label:"월 부담 가볍게 · 3~4만원대"},practical:{min:5e4,max:69999,target:5.9e4,label:"실속 있게 · 5~6만원대"},balanced:{min:7e4,max:99999,target:8.4e4,label:"기기·요금 균형 · 7~9만원대"},premium:{min:1e5,max:13e4,target:11.2e4,label:"좋은 기종 우선 · 10만원 안팎"},any:{min:0,max:1/0,target:0,label:"가격 상관없이 비교"}},profile=profiles[budgetKey]||profiles.light,note=t("quick-budget-note");
note&&(note.textContent="any"===budgetKey?"월 부담 제한 없이 현재 계산 가능한 조합을 넓게 비교합니다.":`${profile.label}를 중심으로 보고, 정확히 맞는 조합이 부족하면 가장 가까운 조건까지 함께 비교합니다.`);
const devices=(o?.devices||[]).filter(e=>e.carrier===carrier&&V(e,brand)&&wbVisibleDevice(e)&&n(e.retail_price)&&Number(e.retail_price)>0&&!xe(e)&&!Ce(e)&&!/폴더|folder/i.test(`${e.name||""} ${e.model||""} ${e.model_code||""}`)).sort(m).slice(0,160),plans=o?.mobile_plans||[],candidates=[];
for(const d of devices){const ids=E(d,join);if(!ids.length)continue;const allowed=new Set(ids);for(const p of plans){if(p.carrier!==carrier||!allowed.has(p.id)||!wbHandsetPlan(p)||!n(p.monthly_fee))continue;const age=String(p.age_limit||"ALL").toUpperCase();if(age&&!['ALL','O_19'].includes(age))continue;const support=T(d,p,join,"support",24,"none"),contract=T(d,p,join,"contract",24,"none"),known=[support,contract].filter(e=>e?.known);if(!known.length)continue;known.sort((e,t)=>e.total24-t.total24);const best=known[0],data=q(p),dataScore=M(p)?1e6:Number.isFinite(data)?Number(data):0;candidates.push({d,p,best,s:support,ct:contract,dataScore})}}
const distance=e=>"any"===budgetKey?0:e.best.monthly<profile.min?profile.min-e.best.monthly:e.best.monthly>profile.max?e.best.monthly-profile.max:0,inBand=e=>"any"===budgetKey||e.best.monthly>=profile.min&&e.best.monthly<=profile.max;
candidates.sort((e,t)=>distance(e)-distance(t)||e.best.monthly-t.best.monthly||String(t.d.release_date||"").localeCompare(String(e.d.release_date||"")));
if(result.innerHTML="",!candidates.length){const e=document.createElement("p");return e.textContent="현재 조건에서 계산 가능한 조합을 찾지 못했습니다. 통신사·가입유형·브랜드를 한 단계 넓혀보세요.",void result.appendChild(e)}
const near=candidates.filter(inBand),pool=(near.length>=3?near:candidates.slice(0,160)),chosen=[],used=new Set,add=(item,kind)=>{item&&!used.has(item.d.id)&&(used.add(item.d.id),chosen.push({...item,kind}))};
add(pool.slice().sort((e,t)=>e.best.monthly-t.best.monthly||distance(e)-distance(t))[0],"cost");
add(pool.filter(e=>!used.has(e.d.id)).sort((e,t)=>distance(e)-distance(t)||Number(t.d.retail_price)-Number(e.d.retail_price)||String(t.d.release_date||"").localeCompare(String(e.d.release_date||"")))[0],"device");
add(pool.filter(e=>!used.has(e.d.id)).sort((e,t)=>t.dataScore-e.dataScore||distance(e)-distance(t)||e.best.monthly-t.best.monthly)[0],"data");
for(const item of candidates){if(chosen.length>=3)break;add(item,"near")}
const meta={cost:{badge:"월 부담 우선",reason:"선택한 부담대에서 월 예상금액을 낮게 맞춘 조합"},device:{badge:"기기 균형",reason:"비슷한 월 부담에서 기기 선택 폭을 한 단계 넓힌 조합"},data:{badge:"데이터 여유",reason:"비슷한 월 부담에서 데이터 제공량이 더 넉넉한 조합"},near:{badge:"가까운 조건",reason:"선택한 부담대에 가장 가까운 계산 가능 조합"}};
chosen.slice(0,3).forEach(({d,p,best,kind})=>{const card=document.createElement("article");card.className="quick-result-card";const method="support"===best.method?"공시지원금":"선택약정 25%",info=meta[kind]||meta.near,band=inBand({best})?profile.label:"선택 부담대에 가까운 조건";card.innerHTML=`<span class="quick-result-badge">${info.badge}</span><strong>${d.name}</strong><em>${p.name} · 요금제 ${e(p.monthly_fee)}</em><div class="quick-plan-specs"><span><small>데이터</small><b>${p.data||"확인 필요"}</b></span><span><small>통화</small><b>${p.voice||"확인 필요"}</b></span><span><small>문자</small><b>${p.sms||"확인 필요"}</b></span></div><div class="quick-result-price"><small>예상 월 납부액</small><b>${e(best.monthly)}</b></div><small class="quick-result-reason">${method} 기준 · ${info.reason}<br>${band}</small>`;const btn=document.createElement("button");btn.type="button",btn.textContent="이 조건으로 자세히 계산",btn.addEventListener("click",()=>function(e,n,o){U=A(e),Z(),I.value=e.carrier,K.value=t("quick-join").value,j.value=o,B.value=e.name||"",z(),F.value=e.id,ie(),P.value=n.id,B.value="",z(),F.value=e.id,ie(),P.value=n.id,Be("direct"),ze(),document.getElementById("direct-mobile-grid")?.scrollIntoView({behavior:"smooth",block:"start"})}(d,p,best.method)),card.appendChild(btn),result.appendChild(card)})
}),["quick-carrier","quick-join","quick-brand","quick-budget"].forEach(e=>t(e)?.addEventListener("change",()=>{const n=t("quick-budget")?.value||"light",o={light:"3~4만원대",practical:"5~6만원대",balanced:"7~9만원대",premium:"10만원 안팎",any:"가격 제한 없음"}[n]||"선택한 월 부담";t("quick-results").innerHTML=`<p>${o} 조건으로 바뀌었습니다. 다시 비교해 주세요.</p>`;const r=t("quick-budget-note");r&&(r.textContent="any"===n?"월 부담 제한 없이 현재 계산 가능한 조합을 넓게 비교합니다.":`${o}를 중심으로 추천합니다. 정확히 맞는 조합이 부족하면 가장 가까운 조건까지 함께 보여드립니다.`)}))'''
s=s[:start]+new_logic+s[end:]
sp.write_text(s,encoding='utf-8')
Path('assets/rates.min.js').write_text(s,encoding='utf-8')

# Styling
cp=Path('assets/rates.css')
css=cp.read_text(encoding='utf-8')
css+='''\n/* Quick recommendation v3 */\n.quick-fields{grid-template-columns:repeat(4,minmax(0,1fr))}.quick-budget-note{margin-top:10px;padding:10px 12px;border-radius:11px;background:#eef6f5;color:#52706f;font-size:.72rem;line-height:1.5}.quick-result-card{gap:8px;background:#fff}.quick-result-badge{display:inline-flex;width:max-content;padding:5px 8px;border-radius:999px;background:#e4f2ef;color:#0f665f}.quick-result-card>em{font-size:.73rem;line-height:1.45}.quick-plan-specs{display:grid;grid-template-columns:1fr;gap:6px;margin:4px 0}.quick-plan-specs>span{display:grid;grid-template-columns:54px 1fr;align-items:start;gap:8px;padding:8px 9px;border-radius:10px;background:#f4f8f9}.quick-plan-specs small{color:#73888f;font-size:.66rem;font-weight:800}.quick-plan-specs b{font-size:.72rem;line-height:1.35;color:#214753}.quick-result-price{display:flex;align-items:end;justify-content:space-between;gap:8px;padding-top:4px;border-top:1px solid #e5edef}.quick-result-price small{font-size:.68rem;color:#6d8087}.quick-result-price b{font-size:1.28rem;color:var(--teal);letter-spacing:-.035em}.quick-result-reason{font-size:.68rem;line-height:1.5;color:#60777f}.quick-result-card button{margin-top:auto}@media(max-width:900px){.quick-fields{grid-template-columns:1fr 1fr}}@media(max-width:760px){.quick-fields{grid-template-columns:1fr}.quick-plan-specs>span{grid-template-columns:50px 1fr}.quick-result-price b{font-size:1.2rem}}\n'''
cp.write_text(css,encoding='utf-8')

# Regression contract
vp=Path('.github/scripts/validate_site.py')
v=vp.read_text(encoding='utf-8')
marker='check("assets/site-pro.min.js?v=" in index, "site production script missing")'
add='''\n# Quick recommendation v3 contract.\ncheck('id="quick-data"' not in rates_html, "legacy quick data selector returned")\ncheck('월 부담 가볍게 · 3~4만원대' in rates_html, "quick monthly burden band missing")\ncheck('내 조건으로 3가지 비교' in rates_html, "quick recommendation title missing")\ncheck('월 부담 우선' in rates and '기기 균형' in rates and '데이터 여유' in rates, "smart quick recommendation lanes missing")\ncheck('quick-plan-specs' in rates, "quick plan allowance display missing")\n'''
if add.strip() not in v:
    if marker not in v:
        raise SystemExit('validator insertion marker missing')
    v=v.replace(marker,marker+add,1)
vp.write_text(v,encoding='utf-8')
