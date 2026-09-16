from pathlib import Path

ROOT=Path('.')
HTML=ROOT/'rates.html'
JS=ROOT/'assets/rates.js'
CSS=ROOT/'assets/rates.css'

html=HTML.read_text(encoding='utf-8')
js=JS.read_text(encoding='utf-8')
css=CSS.read_text(encoding='utf-8')

def replace_once(text, old, new, label):
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'marker not found: {label}')
    return text.replace(old,new,1)

# ------------------------------------------------------------------
# HTML: TV count / additional-terminal monthly fee / compare count.
# ------------------------------------------------------------------
html=replace_once(html,
'''                <label>TV 가입<select id="wired-compare-tv"><option value="none">인터넷만</option><option value="basic" selected>TV 기본형 포함</option></select></label>''',
'''                <label>TV 가입<select id="wired-compare-tv"><option value="none">인터넷만</option><option value="basic" selected>TV 기본형 포함</option></select></label>
                <label>TV 대수<select id="wired-compare-count"><option value="1" selected>1대</option><option value="2">2대 · 추가 1대</option><option value="3">3대 · 추가 2대</option></select></label>''',
'wired compare tv count')

html=replace_once(html,
'''              <label>TV 상품<select id="tv-product" disabled><option value="">통신사를 먼저 선택하세요</option></select></label>
              <div id="tv-product-info" class="tv-product-info">TV 상품을 선택하면 채널수와 기본 특징을 보여드립니다.</div>''',
'''              <label>TV 상품<select id="tv-product" disabled><option value="">통신사를 먼저 선택하세요</option></select></label>
              <div class="field-row two tv-count-row">
                <label>TV 대수<select id="tv-count" disabled><option value="1">TV 1대</option><option value="2">TV 2대 · 추가 1대</option><option value="3">TV 3대 · 추가 2대</option></select></label>
                <div class="additional-tv-box"><span>추가 TV 월요금</span><strong id="extra-tv-fee-view">미적용</strong><small>추가 단말은 같은 주소·명의 기준이며 상품별 제공 조건이 다를 수 있습니다.</small></div>
              </div>
              <div id="tv-product-info" class="tv-product-info">TV 상품을 선택하면 채널수와 기본 특징을 보여드립니다.</div>''',
'tv count selector')

html=replace_once(html,
'''                <div class="auto-box"><span>TV 월정액</span><strong id="tv-fee-view">—</strong></div>
                <div class="auto-box"><span>기본 합계</span><strong id="internet-base-total">—</strong></div>''',
'''                <div class="auto-box"><span>TV 월정액 · 선택 대수 합계</span><strong id="tv-fee-view">—</strong></div>
                <div class="auto-box"><span>기본 합계</span><strong id="internet-base-total">—</strong></div>''',
'tv fee label')

html=replace_once(html,
'''                <div><span>모바일 결합 할인</span><b id="internet-result-mobile-discount">—</b></div>
                <div><span>고객 사은품 (현금+상품권)</span><b id="internet-customer-gift">—</b></div>''',
'''                <div><span>모바일 결합 할인</span><b id="internet-result-mobile-discount">—</b></div>
                <div><span>추가 TV 월요금</span><b id="internet-result-extra-tv">미적용</b></div>
                <div><span>고객 사은품 (현금+상품권)</span><b id="internet-customer-gift">—</b></div>''',
'result extra tv row')

html=replace_once(html,
'''              <div class="data-note">고객사은품은 선택한 상품 기준 최대 금액이며 지역·상품·설치 및 가입 조건에 따라 실제 지급액은 달라질 수 있어 최종 상담 시 확인됩니다.</div>''',
'''              <div class="data-note">고객사은품은 선택한 상품 기준 최대 금액이며 지역·상품·설치 및 가입 조건에 따라 실제 지급액은 달라질 수 있어 최종 상담 시 확인됩니다. TV 2대 이상은 동일 주소·동일 명의의 추가 TV 기준으로 계산하며, 복수단말 제공 여부와 세부 요금은 상품별로 달라질 수 있습니다.</div>''',
'multi tv customer note')

html=html.replace('assets/rates.css?v=20260916-4','assets/rates.css?v=20260916-5')
html=html.replace('assets/rates.js?v=20260916-7','assets/rates.js?v=20260916-8')

# ------------------------------------------------------------------
# JS: verified / conservative additional-TV rules.
# Amounts are customer monthly charges, not policy/rebate data.
# ------------------------------------------------------------------
js=replace_once(js,
'''  const internetCarrier=$('internet-carrier'),internetProduct=$('internet-product'),tvProduct=$('tv-product'),wiredBundle=$('wired-bundle'),mobileBundle=$('mobile-bundle');''',
'''  const internetCarrier=$('internet-carrier'),internetProduct=$('internet-product'),tvProduct=$('tv-product'),tvCount=$('tv-count'),wiredBundle=$('wired-bundle'),mobileBundle=$('mobile-bundle');''',
'wired controls const')

js=replace_once(js,
'''  const BASIC_COMPARE_TV={SKB:'TV-SKB-TV_BASIC_NEW',SKTNET:'TV-SKTNET-ECO',KT:'TV-KT-TV_OTV_BASIC','LGU+':'TV-LGU+-TV_ECONOMY_PACK',LGHELLO:'TV-LGHELLO-TV_UHD_NEW_BASIC',SKYLIFE:'TV-SKYLIFE-TV_IPIT_BASIC'};''',
'''  const BASIC_COMPARE_TV={SKB:'TV-SKB-TV_BASIC_NEW',SKTNET:'TV-SKTNET-ECO',KT:'TV-KT-TV_OTV_BASIC','LGU+':'TV-LGU+-TV_ECONOMY_PACK',LGHELLO:'TV-LGHELLO-TV_UHD_NEW_BASIC',SKYLIFE:'TV-SKYLIFE-TV_IPIT_BASIC'};
  const ADDITIONAL_TV_RULES={
    SKB:{kind:'half_base_plus_settop',settop:4400,keys:['TV_BASIC_NEW','TV_SMART_PLUS','TV_ALL']},
    SKTNET:{kind:'half_base_plus_settop',settop:4400,keys:['SKTNET_TV_ECO','SKTNET_TV_STD','SKTNET_TV_ALL']},
    KT:{kind:'fixed_service_plus_settop',settop:6600,fees:{TV_OTV_BASIC:7370,TV_OTV12:7920,TV_OTV15:8800,TV_OTV_ALLG:21340}},
    SKYLIFE:{kind:'fixed_total',fees:{TV_IPIT_BASIC:7700,TV_IPIT_PLUS:8250}}
  };''',
'additional tv rules')

js=replace_once(js,
'''  function currentTvProduct(){return tvProduct.value==='none'?null:(tvProducts().find(p=>p.id===tvProduct.value)||null)}''',
'''  function currentTvProduct(){return tvProduct.value==='none'?null:(tvProducts().find(p=>p.id===tvProduct.value)||null)}
  function selectedTvCount(){return currentTvProduct()?Math.max(1,Math.min(3,Number(tvCount?.value||1))):0}
  function additionalTvUnit(tv){
    if(!tv)return {known:true,amount:0};
    const rule=ADDITIONAL_TV_RULES[tv.provider_id],key=String(tv.product_key||'');
    if(!rule)return {known:false,amount:0};
    if(rule.kind==='half_base_plus_settop'){
      if(!rule.keys.includes(key)||!hasAmount(tv.monthly_fee??tv.tv_fee))return {known:false,amount:0};
      return {known:true,amount:Number(tv.monthly_fee??tv.tv_fee)*.5+Number(rule.settop||0)};
    }
    if(rule.kind==='fixed_service_plus_settop'){
      if(!hasAmount(rule.fees?.[key]))return {known:false,amount:0};
      return {known:true,amount:Number(rule.fees[key])+Number(rule.settop||0)};
    }
    if(rule.kind==='fixed_total'){
      if(!hasAmount(rule.fees?.[key]))return {known:false,amount:0};
      return {known:true,amount:Number(rule.fees[key])};
    }
    return {known:false,amount:0};
  }
  function additionalTvCalc(tv,count){
    const extra=Math.max(0,Number(count||0)-1);if(!extra)return {known:true,amount:0,unit:0,extra:0};
    const unit=additionalTvUnit(tv);return {known:unit.known,amount:unit.known?unit.amount*extra:0,unit:unit.amount,extra};
  }
  function syncTvCountControl(){
    if(!tvCount)return;const hasTv=!!currentTvProduct();tvCount.disabled=!hasTv;if(!hasTv)tvCount.value='1';
  }''',
'additional tv helpers')

old_scenario='''  function wiredScenario(p,tv){
    if(!p||!hasAmount(p.monthly_fee??p.internet_fee))return {known:false};
    const internetFee=Number(p.monthly_fee??p.internet_fee),tvSelected=!!tv;
    const tvKnown=!tvSelected||hasAmount(tv.monthly_fee??tv.tv_fee);if(!tvKnown)return {known:false};
    const tvFee=tvSelected?Number(tv.monthly_fee??tv.tv_fee):0,combo=tvSelected?WIRED_COMBO_DEFAULTS[p.provider_id]:null;
    const stb=tvSelected?defaultSettop(p.provider_id,tv):null;
    const settopKnown=!tvSelected||!!combo;if(!settopKnown)return {known:false};
    const settopFee=!tvSelected?0:(stb&&hasAmount(stb.monthly_fee)?Number(stb.monthly_fee):Number(combo?.fallbackSettopFee||0));
    const internetDiscount=combo?Math.min(internetFee,comboInternetDiscount(combo,p)):0;
    const tvDiscount=combo?Math.min(tvFee,Number(combo.tvDiscount)||0):0;
    const base=internetFee+tvFee+settopFee,total=Math.max(0,base-internetDiscount-tvDiscount);
    return {known:true,base,total,internetDiscount,tvDiscount,settopFee,gift:customerGiftMax(p,tv)};
  }'''
new_scenario='''  function wiredScenario(p,tv,count=1){
    if(!p||!hasAmount(p.monthly_fee??p.internet_fee))return {known:false};
    const internetFee=Number(p.monthly_fee??p.internet_fee),tvSelected=!!tv;
    const tvKnown=!tvSelected||hasAmount(tv.monthly_fee??tv.tv_fee);if(!tvKnown)return {known:false,gift:customerGiftMax(p,tv)};
    const tvFee=tvSelected?Number(tv.monthly_fee??tv.tv_fee):0,combo=tvSelected?WIRED_COMBO_DEFAULTS[p.provider_id]:null;
    const stb=tvSelected?defaultSettop(p.provider_id,tv):null;
    const settopKnown=!tvSelected||!!combo;if(!settopKnown)return {known:false,gift:customerGiftMax(p,tv)};
    const settopFee=!tvSelected?0:(stb&&hasAmount(stb.monthly_fee)?Number(stb.monthly_fee):Number(combo?.fallbackSettopFee||0));
    const internetDiscount=combo?Math.min(internetFee,comboInternetDiscount(combo,p)):0;
    const tvDiscount=combo?Math.min(tvFee,Number(combo.tvDiscount)||0):0;
    const extra=tvSelected?additionalTvCalc(tv,Math.max(1,Number(count||1))):{known:true,amount:0,extra:0};
    if(!extra.known)return {known:false,gift:customerGiftMax(p,tv),additionalUnknown:true};
    const base=internetFee+tvFee+settopFee+extra.amount,total=Math.max(0,base-internetDiscount-tvDiscount);
    return {known:true,base,total,internetDiscount,tvDiscount,settopFee,additionalTv:extra.amount,tvCount:tvSelected?Math.max(1,Number(count||1)):0,gift:customerGiftMax(p,tv)};
  }'''
js=replace_once(js,old_scenario,new_scenario,'wired scenario multi tv')

old_render='''  function renderWiredComparison(){
    const box=$('wired-compare-results');if(!box)return;
    const speed=Number($('wired-compare-speed')?.value||500),withTv=$('wired-compare-tv')?.value==='basic';
    const providers=(internetData.providers||[]).slice().sort(byOrder),cards=[];
    providers.forEach(provider=>{
      const p=pickCompareInternet(provider.id,speed);if(!p)return;
      const tv=withTv?basicCompareTv(provider.id):null;if(withTv&&!tv)return;
      const s=wiredScenario(p,tv);if(!s.known)return;
      const gift=customerGiftText(s.gift),channel=tv?.channel_label?` · ${tv.channel_label} 채널`:'';
      cards.push(`<article class="wired-compare-card"><span>${escapeWiredHtml(provider.name)}</span><strong>${won(s.total)}</strong><small>월 예상요금</small><p>${escapeWiredHtml(internetProductLabel(p))}${tv?`<br>${escapeWiredHtml(tv.name+channel)}`:''}</p><div><em>고객사은품</em><b>${escapeWiredHtml(gift)}</b></div><button type="button" data-wired-provider="${escapeWiredHtml(provider.id)}" data-wired-product="${escapeWiredHtml(p.id)}" data-wired-tv="${escapeWiredHtml(tv?.id||'none')}">이 조건으로 자세히 보기</button></article>`);
    });
    box.innerHTML=cards.length?cards.join(''):'<p>선택한 속도로 비교 가능한 상품이 없습니다.</p>';
  }'''
new_render='''  function renderWiredComparison(){
    const box=$('wired-compare-results');if(!box)return;
    const speed=Number($('wired-compare-speed')?.value||500),withTv=$('wired-compare-tv')?.value==='basic',count=withTv?Math.max(1,Number($('wired-compare-count')?.value||1)):0;
    const countSel=$('wired-compare-count');if(countSel)countSel.disabled=!withTv;
    const providers=(internetData.providers||[]).slice().sort(byOrder),cards=[];
    providers.forEach(provider=>{
      const p=pickCompareInternet(provider.id,speed);if(!p)return;
      const tv=withTv?basicCompareTv(provider.id):null;if(withTv&&!tv)return;
      const s=wiredScenario(p,tv,count),gift=customerGiftText(s.gift),channel=tv?.channel_label?` · ${tv.channel_label} 채널`:'';
      const total=s.known?won(s.total):'매장 확인',extraText=withTv&&count>1?(s.known?`<small class="wired-extra-line">추가 TV ${count-1}대 포함</small>`:'<small class="wired-extra-line">추가 TV 요금 상담 확인</small>'):'';
      cards.push(`<article class="wired-compare-card"><span>${escapeWiredHtml(provider.name)}</span><strong>${total}</strong><small>월 예상요금</small>${extraText}<p>${escapeWiredHtml(internetProductLabel(p))}${tv?`<br>${escapeWiredHtml(tv.name+channel)} · TV ${count}대`:''}</p><div><em>고객사은품</em><b>${escapeWiredHtml(gift)}</b></div><button type="button" data-wired-provider="${escapeWiredHtml(provider.id)}" data-wired-product="${escapeWiredHtml(p.id)}" data-wired-tv="${escapeWiredHtml(tv?.id||'none')}" data-wired-count="${count||1}">이 조건으로 자세히 보기</button></article>`);
    });
    box.innerHTML=cards.length?cards.join(''):'<p>선택한 속도로 비교 가능한 상품이 없습니다.</p>';
  }'''
js=replace_once(js,old_render,new_render,'wired comparison multi tv')

js=replace_once(js,
'''  function wiredQuoteFingerprint(){return [internetCarrier.value,internetProduct.value,tvProduct.value,wiredBundle.value,mobileBundle.value].join('|')}''',
'''  function wiredQuoteFingerprint(){return [internetCarrier.value,internetProduct.value,tvProduct.value,selectedTvCount()||0,wiredBundle.value,mobileBundle.value].join('|')}''',
'wired quote fingerprint count')

js=replace_once(js,
'''    return [`[웅비통신 유선견적 ${currentWiredQuoteId||''}]`,`${provider?.name||p.provider_id} / ${internetProductLabel(p)}`,`TV: ${tv?.name||'미가입'}`,`유선결합: ${wiredName}`,`모바일결합: ${mobileName}`,`예상 월요금: ${$('internet-total')?.textContent||'매장 확인'}`,`고객사은품: ${$('internet-customer-gift')?.textContent||'매장 확인'}`,'※ 실제 가입 조건은 최종 상담 시 확인됩니다.'].join('\\n');''',
'''    const count=selectedTvCount(),extraText=count>1?$('internet-result-extra-tv')?.textContent||'매장 확인':'미적용';
    return [`[웅비통신 유선견적 ${currentWiredQuoteId||''}]`,`${provider?.name||p.provider_id} / ${internetProductLabel(p)}`,`TV: ${tv?.name||'미가입'}${tv?` / 총 ${count}대`:''}`,`추가 TV 월요금: ${extraText}`,`유선결합: ${wiredName}`,`모바일결합: ${mobileName}`,`예상 월요금: ${$('internet-total')?.textContent||'매장 확인'}`,`고객사은품: ${$('internet-customer-gift')?.textContent||'매장 확인'}`,'※ 실제 가입 조건은 최종 상담 시 확인됩니다.'].join('\\n');''',
'wired quote text count')

js=replace_once(js,
'''    const u=new URL(location.href);u.search='';u.searchParams.set('tab','internet');u.searchParams.set('ic',internetCarrier.value);u.searchParams.set('ip',internetProduct.value);u.searchParams.set('itv',tvProduct.value||'none');u.searchParams.set('iwb',wiredBundle.value||'none');u.searchParams.set('imb',mobileBundle.value||'none');if(currentWiredQuoteId)u.searchParams.set('iq',currentWiredQuoteId);return u.toString();''',
'''    const u=new URL(location.href);u.search='';u.searchParams.set('tab','internet');u.searchParams.set('ic',internetCarrier.value);u.searchParams.set('ip',internetProduct.value);u.searchParams.set('itv',tvProduct.value||'none');u.searchParams.set('itvc',String(selectedTvCount()||1));u.searchParams.set('iwb',wiredBundle.value||'none');u.searchParams.set('imb',mobileBundle.value||'none');if(currentWiredQuoteId)u.searchParams.set('iq',currentWiredQuoteId);return u.toString();''',
wired_quote_url')

js=replace_once(js,
'''    const row={id:currentWiredQuoteId,label:`${provider?.name||p.provider_id} · ${internetSpeedLabel(p)}${tv?' + TV':''}`,total:$('internet-total')?.textContent||'',carrier:internetCarrier.value,product:internetProduct.value,tv:tvProduct.value||'none',wired:wiredBundle.value||'none',mobile:mobileBundle.value||'none',saved_at:Date.now()};''',
'''    const count=selectedTvCount();
    const row={id:currentWiredQuoteId,label:`${provider?.name||p.provider_id} · ${internetSpeedLabel(p)}${tv?` + TV ${count}대`:''}`,total:$('internet-total')?.textContent||'',carrier:internetCarrier.value,product:internetProduct.value,tv:tvProduct.value||'none',count:count||1,wired:wiredBundle.value||'none',mobile:mobileBundle.value||'none',saved_at:Date.now()};''',
'save wired quote count')

js=replace_once(js,
'''    if(!q)return;internetCarrier.value=q.carrier||'';fillInternetProducts();internetProduct.value=q.product||'';tvProduct.value=q.tv||'none';fillInternetBundles();if([...wiredBundle.options].some(o=>o.value===(q.wired||'none')))wiredBundle.value=q.wired||'none';if([...mobileBundle.options].some(o=>o.value===(q.mobile||'none')))mobileBundle.value=q.mobile||'none';if(q.id){currentWiredQuoteId=q.id;currentWiredQuoteFingerprint=wiredQuoteFingerprint()}syncInternet();''',
'''    if(!q)return;internetCarrier.value=q.carrier||'';fillInternetProducts();internetProduct.value=q.product||'';tvProduct.value=q.tv||'none';syncTvCountControl();if(tvCount&&currentTvProduct())tvCount.value=String(Math.max(1,Math.min(3,Number(q.count||1))));fillInternetBundles();if([...wiredBundle.options].some(o=>o.value===(q.wired||'none')))wiredBundle.value=q.wired||'none';if([...mobileBundle.options].some(o=>o.value===(q.mobile||'none')))mobileBundle.value=q.mobile||'none';if(q.id){currentWiredQuoteId=q.id;currentWiredQuoteFingerprint=wiredQuoteFingerprint()}syncInternet();''',
'apply wired quote count')

js=replace_once(js,
'''    applyWiredQuote({id:sp.get('iq')||'',carrier:sp.get('ic'),product:sp.get('ip'),tv:sp.get('itv')||'none',wired:sp.get('iwb')||'none',mobile:sp.get('imb')||'none'});return true;''',
'''    applyWiredQuote({id:sp.get('iq')||'',carrier:sp.get('ic'),product:sp.get('ip'),tv:sp.get('itv')||'none',count:sp.get('itvc')||'1',wired:sp.get('iwb')||'none',mobile:sp.get('imb')||'none'});return true;''',
'restore wired quote count')

js=replace_once(js,
'''    if(pid&&!items.length)$('internet-detail').textContent='현재 확인된 인터넷 상품 요금은 매장에서 안내해 드립니다.';
    fillInternetBundles();''',
'''    syncTvCountControl();
    if(pid&&!items.length)$('internet-detail').textContent='현재 확인된 인터넷 상품 요금은 매장에서 안내해 드립니다.';
    fillInternetBundles();''',
'fill internet tv count')

js=replace_once(js,
'''  function syncInternet(){
    syncTvProductInfo();updateInternetSpeedGuide();updateInternetAvailabilityNote();''',
'''  function syncInternet(){
    syncTvCountControl();syncTvProductInfo();updateInternetSpeedGuide();updateInternetAvailabilityNote();''',
'sync internet tv count control')

js=replace_once(js,
'''      ['internet-fee-view','tv-fee-view','internet-base-total','internet-bundle-discount','internet-total','internet-result-base','internet-result-wired-discount','internet-result-mobile-discount'].forEach(id=>$(id).textContent='—');
      $('internet-customer-gift').textContent='—';''',
'''      ['internet-fee-view','tv-fee-view','internet-base-total','internet-bundle-discount','internet-total','internet-result-base','internet-result-wired-discount','internet-result-mobile-discount'].forEach(id=>$(id).textContent='—');
      if($('extra-tv-fee-view'))$('extra-tv-fee-view').textContent='미적용';if($('internet-result-extra-tv'))$('internet-result-extra-tv').textContent='미적용';
      $('internet-customer-gift').textContent='—';''',
'clear multi tv fields')

js=replace_once(js,
'''    const autoWiredDiscount=autoInternetDiscount+autoTvDiscount;
    const baseKnown=internetKnown&&tvKnown&&settopKnown,base=baseKnown?internetFee+tvBaseFee+settopFee:null;''',
'''    const autoWiredDiscount=autoInternetDiscount+autoTvDiscount;
    const count=tvSelected?selectedTvCount():0,additionalCalc=tvSelected?additionalTvCalc(tv,count):{known:true,amount:0,extra:0};
    const additionalKnown=additionalCalc.known,additionalTotal=additionalCalc.amount;
    const baseKnown=internetKnown&&tvKnown&&settopKnown&&additionalKnown,base=baseKnown?internetFee+tvBaseFee+settopFee+additionalTotal:null;''',
'base includes extra tv')

js=replace_once(js,
'''    $('tv-fee-view').textContent=!tvSelected?'미선택':(tvKnown&&settopKnown?won(Math.max(0,tvBaseFee-autoTvDiscount)+settopFee):'매장 확인');
    $('internet-base-total').textContent=baseKnown?won(base):'매장 확인';''',
'''    const primaryTvMonthly=tvSelected&&tvKnown&&settopKnown?Math.max(0,tvBaseFee-autoTvDiscount)+settopFee:null;
    $('tv-fee-view').textContent=!tvSelected?'미선택':(primaryTvMonthly!==null&&additionalKnown?won(primaryTvMonthly+additionalTotal):'매장 확인');
    if($('extra-tv-fee-view'))$('extra-tv-fee-view').textContent=!tvSelected||count<=1?'미적용':(additionalKnown?won(additionalTotal):'매장 확인');
    if($('internet-result-extra-tv'))$('internet-result-extra-tv').textContent=!tvSelected||count<=1?'미적용':(additionalKnown?`+${won(additionalTotal)}`:'매장 확인');
    $('internet-base-total').textContent=baseKnown?won(base):'매장 확인';''',
'tv monthly extra display')

js=replace_once(js,
'''    const bits=[],speedLabel=internetSpeedLabel(p);if(speedLabel)bits.push(`인터넷 속도 ${speedLabel}`);if(internetHasWifi(p))bits.push('와이파이 포함');if(tvSelected&&tv?.name)bits.push(tv.name);if(tvSelected&&combo)bits.push('인터넷+TV 결합할인 자동 반영');if(wiredRule?.notes)bits.push(wiredRule.notes);if(mobileRule?.notes)bits.push(mobileRule.notes);
    $('internet-detail').textContent=bits.length?bits.join(' · '):'3년 약정 기준 월요금';
    $('internet-summary').textContent=totalKnown?`${provider?.name||p.provider_id} · ${p.name}${tvSelected&&tv?.name?' + '+tv.name:''} 기준 예상 월요금입니다.`:`${provider?.name||p.provider_id} · 선택 상품의 최신 금액은 매장에서 확인해 주세요.`;''',
'''    const bits=[],speedLabel=internetSpeedLabel(p);if(speedLabel)bits.push(`인터넷 속도 ${speedLabel}`);if(internetHasWifi(p))bits.push('와이파이 포함');if(tvSelected&&tv?.name)bits.push(`${tv.name} · TV ${count}대`);if(tvSelected&&count>1)bits.push(additionalKnown?`추가 TV ${count-1}대 ${won(additionalTotal)}`:'추가 TV 요금 매장 확인');if(tvSelected&&combo)bits.push('인터넷+TV 결합할인 자동 반영');if(wiredRule?.notes)bits.push(wiredRule.notes);if(mobileRule?.notes)bits.push(mobileRule.notes);
    $('internet-detail').textContent=bits.length?bits.join(' · '):'3년 약정 기준 월요금';
    $('internet-summary').textContent=totalKnown?`${provider?.name||p.provider_id} · ${p.name}${tvSelected&&tv?.name?' + '+tv.name+` · TV ${count}대`:''} 기준 예상 월요금입니다.`:`${provider?.name||p.provider_id} · 선택 상품의 최신 금액은 매장에서 확인해 주세요.`;''',
'internet summary count')

js=replace_once(js,
'''  tvProduct.addEventListener('change',fillInternetBundles);
  wiredBundle.addEventListener('change',syncInternet);''',
'''  tvProduct.addEventListener('change',()=>{syncTvCountControl();fillInternetBundles()});
  tvCount?.addEventListener('change',syncInternet);
  wiredBundle.addEventListener('change',syncInternet);''',
'events tv count')

js=replace_once(js,
'''  $('wired-compare-tv')?.addEventListener('change',renderWiredComparison);''',
'''  $('wired-compare-tv')?.addEventListener('change',renderWiredComparison);
  $('wired-compare-count')?.addEventListener('change',renderWiredComparison);''',
'compare count event')

js=replace_once(js,
'''    internetCarrier.value=b.dataset.wiredProvider;fillInternetProducts();internetProduct.value=b.dataset.wiredProduct;tvProduct.value=b.dataset.wiredTv||'none';fillInternetBundles();$('internet-form')?.scrollIntoView({behavior:'smooth',block:'start'});''',
'''    internetCarrier.value=b.dataset.wiredProvider;fillInternetProducts();internetProduct.value=b.dataset.wiredProduct;tvProduct.value=b.dataset.wiredTv||'none';syncTvCountControl();if(tvCount&&currentTvProduct())tvCount.value=String(Math.max(1,Math.min(3,Number(b.dataset.wiredCount||1))));fillInternetBundles();$('internet-form')?.scrollIntoView({behavior:'smooth',block:'start'});''',
'comparison click count')

# ------------------------------------------------------------------
# CSS: count selector and extra-TV status.
# ------------------------------------------------------------------
css += '''\n\n/* Multi TV support */\n.tv-count-row{align-items:stretch}.additional-tv-box{display:grid;align-content:center;gap:4px;padding:12px 14px;border:1px solid #d5e3e5;border-radius:12px;background:#f8fbfb}.additional-tv-box>span{font-size:.7rem;font-weight:800;color:#6e838a}.additional-tv-box>strong{font-size:1.08rem;color:var(--teal);letter-spacing:-.03em}.additional-tv-box>small{font-size:.64rem;line-height:1.45;color:#819298}.wired-extra-line{display:block!important;margin-top:2px;color:var(--teal)!important;font-weight:800}@media(max-width:760px){.tv-count-row{grid-template-columns:1fr}}\n'''

HTML.write_text(html,encoding='utf-8')
JS.write_text(js,encoding='utf-8')
CSS.write_text(css,encoding='utf-8')
print('multi TV support patch complete')
