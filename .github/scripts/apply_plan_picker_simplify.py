from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
html_path = ROOT / "rates.html"
js_paths = [ROOT / "src/rates.js", ROOT / "assets/rates.min.js"]
css_path = ROOT / "assets/rates.css"


def must_replace(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing expected text: {label}")
    return text.replace(old, new, 1)

html = html_path.read_text(encoding="utf-8")
html = must_replace(
    html,
    '<div class="plan-picker-label"><span>요금제</span><small>선택한 가입유형·기종에서 가입 가능한 요금제만 보여드립니다.</small></div>',
    '<div class="plan-picker-label"><span>요금제</span><small>추천 요금제부터 간단히 보고, 필요하면 전체 요금제를 확인할 수 있습니다.</small></div>',
    "plan picker label",
)
html = must_replace(html, '<b>요금제 찾기</b>', '<b>추천 요금제 보기</b>', "plan picker button")
html = must_replace(html, 'data-plan-quick-price="under40" disabled>4만원 미만</button>', 'data-plan-quick-price="under40" disabled>가볍게 · 4만원 미만</button>', "quick under40")
html = must_replace(html, 'data-plan-quick-price="40s" disabled>4만원대</button>', 'data-plan-quick-price="40s" disabled>실속 · 4만원대</button>', "quick 40s")
html = must_replace(html, 'data-plan-quick-price="50plus" disabled>5만원 이상</button>', 'data-plan-quick-price="50plus" disabled>넉넉하게 · 5만원+</button>', "quick 50plus")
html = must_replace(html, 'data-plan-quick-feature="benefit" disabled>혜택형</button>', 'data-plan-quick-feature="benefit" disabled>콘텐츠·혜택형</button>', "quick benefit")
html = must_replace(
    html,
    '<section class="plan-picker-sheet" role="dialog" aria-labelledby="plan-picker-title">',
    '<section class="plan-picker-sheet" id="plan-picker-sheet" data-mode="recommend" role="dialog" aria-labelledby="plan-picker-title">',
    "plan picker sheet id",
)
html = must_replace(
    html,
    '<div><span>요금제 선택</span><strong id="plan-picker-title">필요한 조건으로 빠르게 찾기</strong></div>',
    '<div><span>요금제 선택</span><strong id="plan-picker-title">추천부터 보고, 필요하면 전체 보기</strong></div>',
    "plan picker title",
)
head_close = '''                    </div>\n                    <label class="plan-picker-search">요금제 검색<input id="plan-picker-search" type="search" autocomplete="off" placeholder="요금제명, 데이터 용량으로 검색"></label>'''
head_new = '''                    </div>\n                    <div class="plan-picker-modes" role="tablist" aria-label="요금제 보기 방식">\n                      <button type="button" class="active" data-plan-mode="recommend">추천 요금제</button>\n                      <button type="button" data-plan-mode="all">전체 요금제</button>\n                    </div>\n                    <p class="plan-picker-mode-note" id="plan-picker-mode-note">월 부담·데이터·무제한·혜택을 기준으로 먼저 볼 요금제만 추렸습니다.</p>\n                    <label class="plan-picker-search">요금제 검색<input id="plan-picker-search" type="search" autocomplete="off" placeholder="요금제명, 데이터 용량으로 검색"></label>'''
html = must_replace(html, head_close, head_new, "plan picker modes")
html = must_replace(
    html,
    '<small class="plan-picker-note">표시 내용은 현재 등록된 요금제 정보 기준이며 세부 제공 조건은 최종 상담 시 확인해 주세요.</small>',
    '<small class="plan-picker-note">추천은 현재 등록된 일반 요금제의 월 기본료·데이터·명시된 혜택을 기준으로 간단히 추린 결과입니다. 연령·자격·세부 제공 조건은 최종 상담 시 확인해 주세요.</small>',
    "plan picker note",
)
html_path.write_text(html, encoding="utf-8")

helpers_and_renderer = r'''function wbPlanRestricted(e){const t=`${e?.name||""} ${e?.age_limit||""}`.toLowerCase(),n=String(e?.age_limit||"").toUpperCase();return["B_19_34","U_12","U_18"].includes(n)||/시니어|65\+|75\+|청년|유쓰|y덤|키즈|청소년|zem|스쿨덤/.test(t)}function wbPlanRecommendations(){const e=J().filter(e=>n(e.monthly_fee)&&!wbPlanRestricted(e)),t=e.length?e:J().filter(e=>n(e.monthly_fee)),o=[],r=new Set,a=(e,n,a,i)=>{const l=t.filter(e=>!r.has(e.id)&&a(e)).sort((e,t)=>i(e)-i(t)||p(e,t))[0];l&&(r.add(l.id),o.push({plan:l,badge:e,reason:n}))},i=e=>Number(e?.monthly_fee)||1/0;a("월 부담 낮게","월 기본료를 낮춰 시작하기 좋은 일반 요금제",e=>i(e)<5e4,i),a("실속 균형","월 부담과 데이터 제공량을 함께 비교하기 좋은 구간",e=>i(e)>=4e4&&i(e)<7e4,e=>Math.abs(i(e)-55e3)),a("데이터 넉넉","영상·SNS 사용량이 많은 경우 먼저 비교하기 좋은 구성",e=>{const t=q(e);return M(e)||null!==t&&t>=20},i),a("무제한 선호","데이터 무제한 표기가 있는 요금제 중 월 부담이 낮은 구성",M,i),a("혜택 포함","콘텐츠·구독·디바이스 혜택이 요금제명에 명시된 구성",e=>Q(e).length>0,i);for(const e of t.sort((e,t)=>i(e)-i(t)||p(e,t)))if(!r.has(e.id)&&(r.add(e.id),o.push({plan:e,badge:"추가 비교",reason:"가입 가능한 일반 요금제 중 월 기본료가 낮은 순서로 함께 비교"}),o.length>=6))break;return o.slice(0,6)}function wbPlanModeSync(){const e=t("plan-picker-sheet");e&&(e.dataset.mode=X.mode),document.querySelectorAll("[data-plan-mode]").forEach(e=>e.classList.toggle("active",e.dataset.planMode===X.mode));const n=t("plan-picker-mode-note");n&&(n.textContent="recommend"===X.mode?"월 부담·데이터·무제한·혜택을 기준으로 먼저 볼 요금제만 추렸습니다.":"전체 요금제에서 검색·데이터·월 기본료·특징 필터로 직접 좁혀볼 수 있습니다.")}function oe(){const o=t("plan-picker-list"),r=t("plan-picker-count");if(!o||!r)return;!function(){document.querySelectorAll("[data-plan-filter-group]").forEach(e=>e.classList.toggle("active",X[e.dataset.planFilterGroup]===e.dataset.planFilterValue));const e=t("plan-picker-sort");e&&(e.value=X.sort)}(),wbPlanModeSync(),o.innerHTML="";const a=new Map;let i;if("recommend"===X.mode){const e=wbPlanRecommendations();e.forEach(e=>a.set(e.plan.id,e)),i=e.map(e=>e.plan),r.textContent=`먼저 볼 추천 요금제 ${i.length.toLocaleString("ko-KR")}개`}else i=function(){const e=J().filter(te);return"price"===X.sort?e.sort((e,t)=>(Number(e.monthly_fee)||1/0)-(Number(t.monthly_fee)||1/0)||p(e,t)):"data"===X.sort?e.sort((e,t)=>{const n=q(e),o=q(t);return(null===o?-1:o)-(null===n?-1:n)||(Number(e.monthly_fee)||1/0)-(Number(t.monthly_fee)||1/0)}):e.sort(p)}(),r.textContent=`현재 조건에 맞는 요금제 ${i.length.toLocaleString("ko-KR")}개`;if(!i.length){const e=document.createElement("p");return e.className="plan-picker-empty",e.textContent="recommend"===X.mode?"추천으로 추릴 수 있는 일반 요금제가 없습니다. 전체 요금제에서 확인해 주세요.":"조건에 맞는 요금제가 없습니다. 검색어나 필터를 조금 넓혀보세요.",void o.appendChild(e)}i.forEach(t=>{const r=document.createElement("button");r.type="button",r.className="plan-option-card",Q(t).length&&r.classList.add("benefit-plan"),t.id===P.value&&r.classList.add("selected");const i=document.createElement("span");i.className="plan-option-top";const l=document.createElement("strong");l.textContent=t.name;const c=document.createElement("b");c.textContent=n(t.monthly_fee)?e(t.monthly_fee):"매장 확인",i.append(l,c),r.appendChild(i);const s=document.createElement("small");s.textContent=t.data?`데이터 ${t.data}`:"데이터 제공량은 상담 시 확인",r.appendChild(s);const u=a.get(t.id);if(u){const e=document.createElement("div");e.className="plan-recommend-reason";const t=document.createElement("span"),n=document.createElement("strong");t.textContent=u.badge,n.textContent=u.reason,e.append(t,n),r.appendChild(e)}const d=function(e){const t=`${e?.name||""} ${e?.data||""}`.toLowerCase(),n=[],o=Q(e);return o.length&&n.push("혜택형",...o.slice(0,2)),[["65+","65+"],["75+","75+"],["복지","복지"],["이월","이월"],["y덤","Y덤"],["청년","청년"],["유쓰","청년"],["키즈","키즈"],["청소년","청소년"]].forEach(([e,o])=>{t.includes(e)&&!n.includes(o)&&n.push(o)}),n.slice(0,5)}(t);if(d.length){const e=document.createElement("span");e.className="plan-option-tags",d.forEach(t=>{const n=document.createElement("i");n.textContent=t,"혜택형"===t&&n.classList.add("benefit-chip"),e.appendChild(n)}),r.appendChild(e)}const m=document.createElement("em");m.textContent=t.id===P.value?"현재 선택한 요금제":"이 요금제 선택",r.appendChild(m),r.addEventListener("click",()=>{P.value=t.id,ae(),ze()}),o.appendChild(r)})}'''

for path in js_paths:
    js = path.read_text(encoding="utf-8")
    js = must_replace(js, 'const X={data:"all",price:"all",feature:"all",sort:"source",query:""};', 'const X={data:"all",price:"all",feature:"all",sort:"source",query:"",mode:"recommend"};', f"X mode {path.name}")
    js, count = re.subn(r'function oe\(\)\{.*?\}function re\(\)', helpers_and_renderer + 'function re()', js, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"failed replacing plan renderer: {path}")
    js = must_replace(
        js,
        'void(r.textContent=`가입 가능한 요금제 ${J().length.toLocaleString("ko-KR")}개에서 찾아보세요.`)',
        'void(r.textContent="추천 요금제부터 보고, 필요하면 전체 요금제를 확인해 보세요.")',
        f"selected detail {path.name}",
    )
    needle = 'document.querySelectorAll("[data-plan-filter-group]").forEach(e=>e.addEventListener("click",()=>{X[e.dataset.planFilterGroup]=e.dataset.planFilterValue,oe()})),'
    insert = needle + 'document.querySelectorAll("[data-plan-mode]").forEach(e=>e.addEventListener("click",()=>{X.mode="all"===e.dataset.planMode?"all":"recommend","recommend"===X.mode&&(X.data="all",X.price="all",X.feature="all",X.sort="source",X.query="",t("plan-picker-search")&&(t("plan-picker-search").value="")),wbPlanModeSync(),oe()})),'
    js = must_replace(js, needle, insert, f"mode listener {path.name}")
    js = must_replace(js, 'G()&&(X.data="all",X.feature="all",X.price=e.dataset.planQuickPrice||"all"', 'G()&&(X.mode="all",X.data="all",X.feature="all",X.price=e.dataset.planQuickPrice||"all"', f"quick price mode {path.name}")
    js = must_replace(js, 'G()&&(X.data="all",X.price="all",X.feature=e.dataset.planQuickFeature||"all"', 'G()&&(X.mode="all",X.data="all",X.price="all",X.feature=e.dataset.planQuickFeature||"all"', f"quick feature mode {path.name}")
    path.write_text(js, encoding="utf-8")

if js_paths[0].read_text(encoding="utf-8") != js_paths[1].read_text(encoding="utf-8"):
    raise SystemExit("src/rates.js and assets/rates.min.js diverged")

css = css_path.read_text(encoding="utf-8")
marker = "/* Customer-first plan picker */"
if marker not in css:
    css += r'''

/* Customer-first plan picker */
.plan-picker-modes{display:grid;grid-template-columns:1fr 1fr;gap:8px}.plan-picker-modes button{min-height:42px;border:1px solid #cddcdf;border-radius:12px;background:#fff;color:#526b73;font:inherit;font-size:.78rem;font-weight:900;cursor:pointer}.plan-picker-modes button.active{background:var(--navy);border-color:var(--navy);color:#fff;box-shadow:0 3px 10px rgba(16,60,82,.12)}.plan-picker-mode-note{margin:-3px 0 1px;padding:10px 12px;border-radius:11px;background:#f2f7f7;color:#60777f;font-size:.69rem;line-height:1.5}.plan-picker-sheet[data-mode="recommend"] .plan-picker-search,.plan-picker-sheet[data-mode="recommend"] .plan-filter-group{display:none}.plan-picker-sheet[data-mode="recommend"] .plan-picker-toolbar label{display:none!important}.plan-recommend-reason{display:flex;align-items:flex-start;gap:8px;padding:9px 10px;border-radius:10px;background:#eef7f5;color:#315f5b}.plan-recommend-reason span{flex:0 0 auto;padding:3px 6px;border-radius:999px;background:#d8eee9;color:#0f665f;font-size:.61rem;font-weight:900}.plan-recommend-reason strong{font-size:.67rem;line-height:1.45}.plan-picker-sheet[data-mode="recommend"] .plan-picker-list{gap:10px}@media(max-width:760px){.plan-picker-modes{position:sticky;top:0;z-index:2;background:#fff;padding-top:1px}.plan-picker-mode-note{font-size:.66rem}}
'''
css_path.write_text(css, encoding="utf-8")

print("plan picker simplification applied")
