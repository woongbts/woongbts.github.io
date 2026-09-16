from pathlib import Path

ROOT = Path('.')
HTML = ROOT / 'rates.html'
JS = ROOT / 'assets/rates.js'
CSS = ROOT / 'assets/rates.css'

html = HTML.read_text(encoding='utf-8')
js = JS.read_text(encoding='utf-8')
css = CSS.read_text(encoding='utf-8')

old_html = '''                    <div class="plan-filter-group">
                      <span>월 기본료</span>
                      <div>
                        <button type="button" class="active" data-plan-filter-group="price" data-plan-filter-value="all">전체</button>
                        <button type="button" data-plan-filter-group="price" data-plan-filter-value="under40">4만원 미만</button>
                        <button type="button" data-plan-filter-group="price" data-plan-filter-value="40s">4만원대</button>
                        <button type="button" data-plan-filter-group="price" data-plan-filter-value="50plus">5만원 이상</button>
                      </div>
                    </div>
                    <div class="plan-picker-toolbar">'''
new_html = '''                    <div class="plan-filter-group">
                      <span>월 기본료</span>
                      <div>
                        <button type="button" class="active" data-plan-filter-group="price" data-plan-filter-value="all">전체</button>
                        <button type="button" data-plan-filter-group="price" data-plan-filter-value="under40">4만원 미만 · 실속</button>
                        <button type="button" data-plan-filter-group="price" data-plan-filter-value="40s">4만원대 · 균형</button>
                        <button type="button" data-plan-filter-group="price" data-plan-filter-value="50plus">5만원 이상 · 넉넉하게</button>
                      </div>
                      <small class="plan-filter-hint">5만원 이상에는 데이터 제공량이 큰 요금제와 콘텐츠·디바이스 등 혜택형 요금제가 함께 포함될 수 있어요.</small>
                    </div>
                    <div class="plan-filter-group plan-feature-group">
                      <span>특징으로 찾기</span>
                      <div>
                        <button type="button" class="active" data-plan-filter-group="feature" data-plan-filter-value="all">전체</button>
                        <button type="button" data-plan-filter-group="feature" data-plan-filter-value="benefit">혜택형</button>
                        <button type="button" data-plan-filter-group="feature" data-plan-filter-value="senior">시니어</button>
                        <button type="button" data-plan-filter-group="feature" data-plan-filter-value="youth">청년</button>
                        <button type="button" data-plan-filter-group="feature" data-plan-filter-value="kids">키즈·청소년</button>
                      </div>
                      <small class="plan-filter-hint">혜택형은 요금제명에 콘텐츠·구독·디바이스 등 혜택이 명시된 상품만 표시합니다.</small>
                    </div>
                    <div class="plan-picker-toolbar">'''
if old_html not in html:
    raise SystemExit('HTML price filter block not found')
html = html.replace(old_html, new_html, 1)

old_state = "const planPickerState={data:'all',price:'all',sort:'source',query:''};"
new_state = "const planPickerState={data:'all',price:'all',feature:'all',sort:'source',query:''};"
if old_state not in js:
    raise SystemExit('planPickerState target not found')
js = js.replace(old_state, new_state, 1)

old_tags = '''  function planPickerTags(p){
    const text=`${p?.name||''} ${p?.data||''}`.toLowerCase(),tags=[];
    [['65+','65+'],['복지','복지'],['이월','이월'],['y덤','Y덤'],['청년','청년'],['키즈','키즈']].forEach(([needle,label])=>{if(text.includes(needle)&&!tags.includes(label))tags.push(label)});
    return tags.slice(0,4);
  }
'''
new_tags = '''  function planBenefitLabels(p){
    const name=String(p?.name||'').toLowerCase(),labels=[];
    const add=label=>{if(label&&!labels.includes(label))labels.push(label)};
    if(name.includes('넷플릭스'))add('넷플릭스');
    if(name.includes('유튜브 프리미엄'))add('유튜브 프리미엄');
    if(name.includes('디즈니+')||name.includes('디즈니 플러스'))add('디즈니+');
    if(name.includes('티빙&웨이브'))add('티빙·웨이브');
    else if(name.includes('티빙/지니/밀리'))add('티빙·지니·밀리');
    else if(name.includes('티빙'))add('티빙');
    if(name.includes('t 우주')||name.includes('t우주'))add('T우주');
    if(name.includes('google ai')||name.includes('구글 ai'))add('Google AI');
    if(name.includes('구글원+보상패스'))add('구글원·보상패스');
    if(name.includes('위버스'))add('위버스');
    if(name.includes('가전구독'))add('가전구독');
    if(name.includes('폰케어'))add('폰케어');
    if(name.includes('삼성디바이스')||(p?.carrier==='KT'&&name.includes('초이스')&&name.includes('삼성')))add('삼성 혜택');
    if(name.includes('애플디바이스'))add('애플 혜택');
    if(name.includes('마니아디바이스')||(p?.carrier==='KT'&&name.includes('초이스')&&name.includes('디바이스'))||(p?.carrier==='SKT'&&name.includes('베스트')&&name.includes('스마트기기')))add('디바이스 혜택');
    return labels;
  }
  function planFeatureMatch(p,feature){
    if(feature==='all')return true;
    const name=String(p?.name||'').toLowerCase(),age=String(p?.age_limit||'').toUpperCase();
    if(feature==='benefit')return planBenefitLabels(p).length>0;
    if(feature==='senior')return age.includes('65')||age.includes('75')||name.includes('시니어')||name.includes('65+')||name.includes('75+');
    if(feature==='youth')return age==='B_19_34'||name.includes('청년')||name.includes('y덤')||name.includes('유쓰')||name.includes('uth');
    if(feature==='kids')return age==='U_12'||age==='U_18'||name.includes('키즈')||name.includes('청소년')||name.includes('스쿨덤')||name.includes('zem');
    return true;
  }
  function planPickerTags(p){
    const text=`${p?.name||''} ${p?.data||''}`.toLowerCase(),tags=[];
    const benefits=planBenefitLabels(p);if(benefits.length)tags.push('혜택형',...benefits.slice(0,2));
    [['65+','65+'],['75+','75+'],['복지','복지'],['이월','이월'],['y덤','Y덤'],['청년','청년'],['유쓰','청년'],['키즈','키즈'],['청소년','청소년']].forEach(([needle,label])=>{if(text.includes(needle)&&!tags.includes(label))tags.push(label)});
    return tags.slice(0,5);
  }
'''
if old_tags not in js:
    raise SystemExit('planPickerTags target not found')
js = js.replace(old_tags, new_tags, 1)

old_match_tail = "    if(planPickerState.data==='unlimited'&&!planHasUnlimited(p))return false;\n    return true;"
new_match_tail = "    if(planPickerState.data==='unlimited'&&!planHasUnlimited(p))return false;\n    if(!planFeatureMatch(p,planPickerState.feature))return false;\n    return true;"
if old_match_tail not in js:
    raise SystemExit('planPickerMatches tail not found')
js = js.replace(old_match_tail, new_match_tail, 1)

old_card = "      const card=document.createElement('button');card.type='button';card.className='plan-option-card';if(p.id===planSelect.value)card.classList.add('selected');"
new_card = "      const card=document.createElement('button');card.type='button';card.className='plan-option-card';if(planBenefitLabels(p).length)card.classList.add('benefit-plan');if(p.id===planSelect.value)card.classList.add('selected');"
if old_card not in js:
    raise SystemExit('plan card target not found')
js = js.replace(old_card, new_card, 1)

old_chip = "tags.forEach(tag=>{const chip=document.createElement('i');chip.textContent=tag;tagBox.appendChild(chip)})"
new_chip = "tags.forEach(tag=>{const chip=document.createElement('i');chip.textContent=tag;if(tag==='혜택형')chip.classList.add('benefit-chip');tagBox.appendChild(chip)})"
if old_chip not in js:
    raise SystemExit('tag chip target not found')
js = js.replace(old_chip, new_chip, 1)

old_css_version = 'assets/rates.css?v=20260916-7'
new_css_version = 'assets/rates.css?v=20260916-8'
if old_css_version not in html:
    raise SystemExit('CSS version target not found')
html = html.replace(old_css_version, new_css_version, 1)
old_js_version = 'assets/rates.js?v=20260916-11'
new_js_version = 'assets/rates.js?v=20260916-12'
if old_js_version not in html:
    raise SystemExit('JS version target not found')
html = html.replace(old_js_version, new_js_version, 1)

css_add = '''

/* Plan benefit discovery */
.plan-filter-hint{display:block;color:#819298;font-size:.63rem;line-height:1.45;margin-top:1px}.plan-filter-group button[data-plan-filter-value="50plus"]:not(.active){background:#f6faf7;border-color:#cfdfd4;color:#4d6c58}.plan-filter-group button[data-plan-filter-value="benefit"]:not(.active){background:#f3f9f6;border-color:#c9dfd2;color:#3f6952}.plan-option-card.benefit-plan{border-color:#cfe2d6;background:linear-gradient(135deg,#fbfefc 0%,#f4faf7 100%)}.plan-option-card.benefit-plan:hover,.plan-option-card.benefit-plan:focus-visible{border-color:#8ebaa0}.plan-option-tags i.benefit-chip{background:#dff1e6;color:#276143}.plan-option-card.benefit-plan.selected{border-color:var(--teal);background:#f7fcf9}
'''
if '/* Plan benefit discovery */' not in css:
    css += css_add

assert "feature:'all'" in js
assert "planBenefitLabels" in js
assert "planFeatureMatch(p,planPickerState.feature)" in js
assert 'data-plan-filter-value="benefit"' in html
assert '5만원 이상 · 넉넉하게' in html
assert 'rates.js?v=20260916-12' in html
assert 'rates.css?v=20260916-8' in html

HTML.write_text(html, encoding='utf-8')
JS.write_text(js, encoding='utf-8')
CSS.write_text(css, encoding='utf-8')
