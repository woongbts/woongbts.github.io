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
# HTML: wired comparison, speed guidance, saved/shared wired quotes.
# ------------------------------------------------------------------
compare_html='''          <section class="wired-compare-tool" id="wired-compare-tool">
            <div class="wired-compare-head">
              <div><span class="eyebrow">한눈에 비교</span><h3>같은 조건으로 통신사 비교</h3><p>속도와 TV 가입 여부를 고르면 각 통신사의 월 예상요금과 고객사은품 최대 금액을 나란히 보여드립니다.</p></div>
              <div class="wired-compare-controls">
                <label>인터넷 속도<select id="wired-compare-speed"><option value="100">100M급</option><option value="500" selected>500M</option><option value="1000">1G</option></select></label>
                <label>TV 가입<select id="wired-compare-tv"><option value="none">인터넷만</option><option value="basic" selected>TV 기본형 포함</option></select></label>
              </div>
            </div>
            <div class="wired-compare-results" id="wired-compare-results"><p>상품 데이터를 불러오고 있습니다.</p></div>
            <small class="wired-compare-note">TV 기본형 비교는 각 통신사의 대표 기본 TV 상품을 적용합니다. 결합 조건·설치 주소에 따라 실제 요금은 달라질 수 있습니다.</small>
          </section>
'''
marker='''          <div class="rate-panel-head"><div><span class="eyebrow">인터넷·TV</span><h2>상품과 결합을 함께 계산</h2></div><span class="updated" id="internet-updated">데이터 기준 확인 중</span></div>
          <div class="rate-grid">'''
html=replace_once(html,marker,marker.replace('          <div class="rate-grid">',compare_html+'          <div class="rate-grid">'),'wired compare section')

old='''              <label>인터넷 속도·상품<select id="internet-product" disabled><option value="">통신사를 먼저 선택하세요</option></select></label>
              <label>TV 상품<select id="tv-product" disabled><option value="">통신사를 먼저 선택하세요</option></select></label>
              <div id="tv-product-info" class="tv-product-info">TV 상품을 선택하면 채널수와 기본 특징을 보여드립니다.</div>'''
new='''              <label>인터넷 속도·상품<select id="internet-product" disabled><option value="">통신사를 먼저 선택하세요</option></select></label>
              <div id="internet-speed-guide" class="internet-speed-guide">속도를 선택하면 일반적인 사용 예시를 안내해 드립니다.</div>
              <label>TV 상품<select id="tv-product" disabled><option value="">통신사를 먼저 선택하세요</option></select></label>
              <div id="tv-product-info" class="tv-product-info">TV 상품을 선택하면 채널수와 기본 특징을 보여드립니다.</div>
              <div id="internet-availability-note" class="internet-availability-note" hidden></div>'''
html=replace_once(html,old,new,'speed guide')

quote_html='''              <section class="wired-quote-memory" id="wired-quote-memory">
                <div class="wired-quote-head"><div><span>유선 견적번호</span><strong id="wired-quote-number">견적 생성 전</strong></div><button type="button" id="save-wired-quote">이 견적 저장</button></div>
                <div class="wired-recent-title">최근 유선 견적</div>
                <div class="wired-recent-list" id="wired-recent-list"><p>아직 저장된 유선 견적이 없습니다.</p></div>
              </section>
              <div class="wired-quote-tools">
                <button type="button" id="copy-wired-quote">견적 복사</button>
                <button type="button" id="share-wired-quote">견적 공유</button>
                <button type="button" class="primary" id="consult-wired-quote">이 조건으로 상담하기</button>
                <button type="button" id="add-mobile-to-wired">휴대폰도 같이 계산</button>
                <small id="wired-quote-status" aria-live="polite"></small>
              </div>
'''
old='''              <p id="internet-summary">통신사와 상품을 선택하면 자동으로 반영됩니다.</p>
              <div class="data-note">고객사은품은 선택한 상품 기준 최대 금액이며 지역·상품·설치 및 가입 조건에 따라 실제 지급액은 달라질 수 있어 최종 상담 시 확인됩니다.</div>'''
new='''              <p id="internet-summary">통신사와 상품을 선택하면 자동으로 반영됩니다.</p>
'''+quote_html+'''              <div class="data-note">고객사은품은 선택한 상품 기준 최대 금액이며 지역·상품·설치 및 가입 조건에 따라 실제 지급액은 달라질 수 있어 최종 상담 시 확인됩니다.</div>'''
html=replace_once(html,old,new,'wired quote tools')
html=html.replace('assets/rates.css?v=20260916-3','assets/rates.css?v=20260916-4')
html=html.replace('assets/rates.js?v=20260916-6','assets/rates.js?v=20260916-7')
HTML.write_text(html,encoding='utf-8')

# ------------------------------------------------------------------
# JS: comparison engine, usage guide, wired quote save/share/restore.
# ------------------------------------------------------------------
old="""  const internetCarrier=$('internet-carrier'),internetProduct=$('internet-product'),tvProduct=$('tv-product'),wiredBundle=$('wired-bundle'),mobileBundle=$('mobile-bundle');
"""
new=old+"""  const WIRED_RECENT_QUOTE_KEY='woongbi-wired-quotes-v1';
  let currentWiredQuoteId='',currentWiredQuoteFingerprint='';
  const BASIC_COMPARE_TV={SKB:'TV-SKB-TV_BASIC_NEW',SKTNET:'TV-SKTNET-ECO',KT:'TV-KT-TV_OTV_BASIC','LGU+':'TV-LGU+-TV_ECONOMY_PACK',LGHELLO:'TV-LGHELLO-TV_UHD_NEW_BASIC',SKYLIFE:'TV-SKYLIFE-TV_IPIT_BASIC'};
"""
js=replace_once(js,old,new,'wired constants')

anchor="""  function customerGiftMax(p,tv){
"""
functions=r'''  function internetUsageGuide(p){
    const speed=Number(p?.speed_mbps);
    if(!Number.isFinite(speed)||speed<=0)return '속도를 선택하면 일반적인 사용 예시를 안내해 드립니다.';
    if(speed<=200)return `${internetSpeedLabel(p)} · 웹서핑·영상 시청 중심, 1~2인 가구에서 많이 선택하는 속도입니다.`;
    if(speed<1000)return `${internetSpeedLabel(p)} · 여러 기기 동시 사용·OTT·온라인게임을 함께 쓰는 가정에 여유로운 속도입니다.`;
    return `${internetSpeedLabel(p)} · 대용량 다운로드·고화질 스트리밍·여러 기기 동시 사용이 많은 환경에 적합한 상위 속도입니다.`;
  }
  function updateInternetSpeedGuide(){
    const el=$('internet-speed-guide');if(el)el.textContent=internetUsageGuide(currentInternetProduct());
  }
  function updateInternetAvailabilityNote(){
    const el=$('internet-availability-note');if(!el)return;
    const pid=internetCarrier.value;
    const messages={LGHELLO:'헬로비전은 지역에 따라 설치 가능 상품과 망이 달라질 수 있어 주소 확인이 필요합니다.',SKYLIFE:'스카이라이프 인터넷·TV는 설치 주소와 제공 망에 따라 가입 가능 여부를 확인해야 합니다.'};
    if(messages[pid]){el.hidden=false;el.textContent=messages[pid]}else{el.hidden=true;el.textContent=''}
  }
  function pickCompareInternet(providerId,speed){
    const rows=internetProducts().filter(p=>p.provider_id===providerId&&Number(p.speed_mbps)===Number(speed));
    if(!rows.length)return null;
    if(providerId==='KT')return rows.find(p=>String(p.product_group||'').toUpperCase()==='WIFI')||rows[0];
    if(providerId==='SKYLIFE')return rows.find(p=>String(p.product_group||'').toUpperCase()==='BASIC')||rows[0];
    return rows.slice().sort(byOrder)[0];
  }
  function basicCompareTv(providerId){
    const id=BASIC_COMPARE_TV[providerId];return tvProducts().find(t=>t.id===id)||tvProducts().filter(t=>t.provider_id===providerId).sort(byOrder)[0]||null;
  }
  function wiredScenario(p,tv){
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
  }
  function escapeWiredHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function renderWiredComparison(){
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
  }
  function makeWiredQuoteId(){const d=new Date(),pad=n=>String(n).padStart(2,'0');return `WBI-${String(d.getFullYear()).slice(-2)}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`}
  function wiredQuoteFingerprint(){return [internetCarrier.value,internetProduct.value,tvProduct.value,wiredBundle.value,mobileBundle.value].join('|')}
  function syncWiredQuoteId(){
    const p=currentInternetProduct(),el=$('wired-quote-number');if(!el)return;
    if(!p){currentWiredQuoteId='';currentWiredQuoteFingerprint='';el.textContent='견적 생성 전';return}
    const fp=wiredQuoteFingerprint();if(!currentWiredQuoteId||fp!==currentWiredQuoteFingerprint){currentWiredQuoteId=makeWiredQuoteId();currentWiredQuoteFingerprint=fp}el.textContent=currentWiredQuoteId;
  }
  function buildWiredQuoteText(){
    const p=currentInternetProduct(),tv=currentTvProduct(),provider=(internetData.providers||[]).find(x=>x.id===internetCarrier.value);if(!p)return '';
    const wiredName=selectedRule(wiredBundle)?.name||((tv&&WIRED_COMBO_DEFAULTS[p.provider_id])?'인터넷+TV 결합 자동적용':'미적용');
    const mobileName=selectedRule(mobileBundle)?.name||'미적용';
    return [`[웅비통신 유선견적 ${currentWiredQuoteId||''}]`,`${provider?.name||p.provider_id} / ${internetProductLabel(p)}`,`TV: ${tv?.name||'미가입'}`,`유선결합: ${wiredName}`,`모바일결합: ${mobileName}`,`예상 월요금: ${$('internet-total')?.textContent||'매장 확인'}`,`고객사은품: ${$('internet-customer-gift')?.textContent||'매장 확인'}`,'※ 실제 가입 조건은 최종 상담 시 확인됩니다.'].join('\n');
  }
  function buildWiredQuoteUrl(){
    const u=new URL(location.href);u.search='';u.searchParams.set('tab','internet');u.searchParams.set('ic',internetCarrier.value);u.searchParams.set('ip',internetProduct.value);u.searchParams.set('itv',tvProduct.value||'none');u.searchParams.set('iwb',wiredBundle.value||'none');u.searchParams.set('imb',mobileBundle.value||'none');if(currentWiredQuoteId)u.searchParams.set('iq',currentWiredQuoteId);return u.toString();
  }
  function readWiredQuotes(){try{return JSON.parse(localStorage.getItem(WIRED_RECENT_QUOTE_KEY)||'[]')}catch{return []}}
  function renderWiredRecentQuotes(){
    const box=$('wired-recent-list');if(!box)return;const rows=readWiredQuotes();
    if(!rows.length){box.innerHTML='<p>아직 저장된 유선 견적이 없습니다.</p>';return}
    box.innerHTML=rows.map((q,i)=>`<button type="button" data-wired-recent="${i}"><span>${escapeWiredHtml(q.id)}</span><strong>${escapeWiredHtml(q.label)}</strong><small>${escapeWiredHtml(q.total||'')}</small></button>`).join('');
  }
  function saveWiredQuote(){
    const p=currentInternetProduct();if(!p)return false;syncWiredQuoteId();const provider=(internetData.providers||[]).find(x=>x.id===internetCarrier.value),tv=currentTvProduct();
    const row={id:currentWiredQuoteId,label:`${provider?.name||p.provider_id} · ${internetSpeedLabel(p)}${tv?' + TV':''}`,total:$('internet-total')?.textContent||'',carrier:internetCarrier.value,product:internetProduct.value,tv:tvProduct.value||'none',wired:wiredBundle.value||'none',mobile:mobileBundle.value||'none',saved_at:Date.now()};
    const rows=readWiredQuotes().filter(x=>x.id!==row.id);rows.unshift(row);localStorage.setItem(WIRED_RECENT_QUOTE_KEY,JSON.stringify(rows.slice(0,5)));renderWiredRecentQuotes();return true;
  }
  function applyWiredQuote(q){
    if(!q)return;internetCarrier.value=q.carrier||'';fillInternetProducts();internetProduct.value=q.product||'';tvProduct.value=q.tv||'none';fillInternetBundles();if([...wiredBundle.options].some(o=>o.value===(q.wired||'none')))wiredBundle.value=q.wired||'none';if([...mobileBundle.options].some(o=>o.value===(q.mobile||'none')))mobileBundle.value=q.mobile||'none';if(q.id){currentWiredQuoteId=q.id;currentWiredQuoteFingerprint=wiredQuoteFingerprint()}syncInternet();
  }
  function restoreInternetQuoteFromUrl(){
    const sp=new URLSearchParams(location.search);if(sp.get('tab')!=='internet'||!sp.get('ic')||!sp.get('ip'))return false;
    document.querySelectorAll('.rate-tab').forEach(x=>x.classList.toggle('active',x.dataset.tab==='internet'));document.querySelectorAll('.rate-panel').forEach(x=>x.classList.toggle('active',x.dataset.panel==='internet'));
    applyWiredQuote({id:sp.get('iq')||'',carrier:sp.get('ic'),product:sp.get('ip'),tv:sp.get('itv')||'none',wired:sp.get('iwb')||'none',mobile:sp.get('imb')||'none'});return true;
  }

'''
js=replace_once(js,anchor,functions+anchor,'wired functions')

# Keep guidance/quote state synchronized with normal calculations.
js=replace_once(js,"""  function syncInternet(){
    syncTvProductInfo();
""","""  function syncInternet(){
    syncTvProductInfo();updateInternetSpeedGuide();updateInternetAvailabilityNote();
""",'sync guide')

js=replace_once(js,"""      $('internet-customer-gift').textContent='—';
      $('internet-summary').textContent=internetCarrier.value?'현재 확인된 상품 요금은 매장에서 안내해 드립니다.':'통신사와 상품을 선택하면 자동으로 반영됩니다.';
      return;
""","""      $('internet-customer-gift').textContent='—';
      $('internet-summary').textContent=internetCarrier.value?'현재 확인된 상품 요금은 매장에서 안내해 드립니다.':'통신사와 상품을 선택하면 자동으로 반영됩니다.';
      syncWiredQuoteId();
      return;
""",'empty quote sync')

js=replace_once(js,"""    $('internet-summary').textContent=totalKnown?`${provider?.name||p.provider_id} · ${p.name}${tvSelected&&tv?.name?' + '+tv.name:''} 기준 예상 월요금입니다.`:`${provider?.name||p.provider_id} · 선택 상품의 최신 금액은 매장에서 확인해 주세요.`;
  }
""","""    $('internet-summary').textContent=totalKnown?`${provider?.name||p.provider_id} · ${p.name}${tvSelected&&tv?.name?' + '+tv.name:''} 기준 예상 월요금입니다.`:`${provider?.name||p.provider_id} · 선택 상품의 최신 금액은 매장에서 확인해 주세요.`;
    syncWiredQuoteId();
  }
""",'quote sync')

listeners=r'''  $('wired-compare-speed')?.addEventListener('change',renderWiredComparison);
  $('wired-compare-tv')?.addEventListener('change',renderWiredComparison);
  $('wired-compare-results')?.addEventListener('click',e=>{
    const b=e.target.closest('[data-wired-provider]');if(!b)return;
    internetCarrier.value=b.dataset.wiredProvider;fillInternetProducts();internetProduct.value=b.dataset.wiredProduct;tvProduct.value=b.dataset.wiredTv||'none';fillInternetBundles();$('internet-form')?.scrollIntoView({behavior:'smooth',block:'start'});
  });
  $('save-wired-quote')?.addEventListener('click',()=>{const ok=saveWiredQuote(),s=$('wired-quote-status');if(s)s.textContent=ok?'이 기기에 견적을 저장했습니다.':'상품을 먼저 선택해 주세요.'});
  $('copy-wired-quote')?.addEventListener('click',async()=>{const t=buildWiredQuoteText(),s=$('wired-quote-status');if(!t){if(s)s.textContent='상품을 먼저 선택해 주세요.';return}try{await navigator.clipboard.writeText(t);if(s)s.textContent='견적 내용을 복사했습니다.'}catch{if(s)s.textContent='복사하지 못했습니다. 공유 버튼을 이용해 주세요.'}});
  $('share-wired-quote')?.addEventListener('click',async()=>{const t=buildWiredQuoteText(),u=buildWiredQuoteUrl(),s=$('wired-quote-status');if(!t){if(s)s.textContent='상품을 먼저 선택해 주세요.';return}try{if(navigator.share)await navigator.share({title:'웅비통신 인터넷·TV 견적',text:t,url:u});else{await navigator.clipboard.writeText(u);if(s)s.textContent='같은 견적을 다시 여는 링크를 복사했습니다.'}}catch(e){if(e?.name!=='AbortError'&&s)s.textContent='공유하지 못했습니다.'}});
  $('consult-wired-quote')?.addEventListener('click',async()=>{const t=buildWiredQuoteText(),s=$('wired-quote-status');if(!t){if(s)s.textContent='상품을 먼저 선택해 주세요.';return}try{await navigator.clipboard.writeText(t)}catch{}window.open('http://pf.kakao.com/_nWwNT/chat','_blank','noopener');if(s)s.textContent='견적 내용을 복사했습니다. 상담창에 붙여넣어 주세요.'});
  $('wired-recent-list')?.addEventListener('click',e=>{const b=e.target.closest('[data-wired-recent]');if(!b)return;applyWiredQuote(readWiredQuotes()[Number(b.dataset.wiredRecent)])});
  $('add-mobile-to-wired')?.addEventListener('click',()=>{
    const map={SKB:'SKT',SKTNET:'SKT',KT:'KT','LGU+':'LGU+'},target=map[internetCarrier.value];
    document.querySelectorAll('.rate-tab').forEach(x=>x.classList.toggle('active',x.dataset.tab==='mobile'));document.querySelectorAll('.rate-panel').forEach(x=>x.classList.toggle('active',x.dataset.panel==='mobile'));
    if(target){carrier.value=target;fillDevices()}document.querySelector('[data-panel="mobile"]')?.scrollIntoView({behavior:'smooth',block:'start'});
  });
'''
old="""  mobileBundle.addEventListener('change',syncInternet);

  Promise.all([
"""
js=replace_once(js,old,"""  mobileBundle.addEventListener('change',syncInternet);
"""+listeners+"""
  Promise.all([
""",'wired listeners')

old="""    fillDevices();fillMvnoProviders();fillPrepaidProviders();fillInternetProviders();renderRecentQuotes();restoreQuoteFromUrl();suspendUrlSync=false;syncMobile();
"""
new="""    fillDevices();fillMvnoProviders();fillPrepaidProviders();fillInternetProviders();renderWiredComparison();renderWiredRecentQuotes();const restoredWired=restoreInternetQuoteFromUrl();renderRecentQuotes();if(!restoredWired)restoreQuoteFromUrl();suspendUrlSync=false;syncMobile();
"""
js=replace_once(js,old,new,'load wired tools')
JS.write_text(js,encoding='utf-8')

# ------------------------------------------------------------------
# CSS: compact, mobile-friendly comparison and wired quote controls.
# ------------------------------------------------------------------
css_add=r'''

/* Wired consultation v3 */
.wired-compare-tool{margin:0 0 16px;padding:20px;background:#fff;border:1px solid var(--line);border-radius:20px;box-shadow:0 8px 24px rgba(16,60,82,.05)}
.wired-compare-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:14px}.wired-compare-head h3{margin:7px 0 4px;font-size:1.15rem;letter-spacing:-.03em}.wired-compare-head p{margin:0;max-width:600px;color:var(--muted);font-size:.76rem;line-height:1.55}.wired-compare-controls{display:grid;grid-template-columns:1fr 1fr;gap:8px;min-width:310px}.wired-compare-controls label{display:grid;gap:5px;color:#526970;font-size:.7rem;font-weight:850}.wired-compare-controls select{min-height:42px;border:1px solid #cddcdf;border-radius:11px;background:#fff;padding:8px 10px;color:#183c48;font:inherit}.wired-compare-results{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.wired-compare-results>p{grid-column:1/-1;margin:0;padding:12px;border-radius:12px;background:#f4f8f9;color:var(--muted);font-size:.74rem}.wired-compare-card{display:grid;gap:4px;padding:14px;border:1px solid #d5e3e5;border-radius:14px;background:#f8fbfb}.wired-compare-card>span{font-size:.7rem;color:var(--teal);font-weight:900}.wired-compare-card>strong{font-size:1.3rem;color:var(--teal);letter-spacing:-.04em}.wired-compare-card>small{font-size:.64rem;color:var(--muted)}.wired-compare-card>p{min-height:3.6em;margin:5px 0!important;font-size:.7rem!important;line-height:1.5!important;color:#526970!important}.wired-compare-card>div{display:flex;justify-content:space-between;gap:8px;padding-top:7px;border-top:1px solid var(--line);font-size:.68rem}.wired-compare-card>div em{font-style:normal;color:var(--muted)}.wired-compare-card>div b{color:var(--navy)}.wired-compare-card button{min-height:38px;margin-top:4px;border:0;border-radius:10px;background:var(--navy);color:#fff;font-weight:900;cursor:pointer}.wired-compare-note{display:block;margin-top:10px;color:#819298;font-size:.66rem;line-height:1.5}
.internet-speed-guide,.internet-availability-note{padding:11px 12px;border:1px solid #d5e3e5;border-radius:12px;background:#f8fbfb;color:#526970;font-size:.72rem;line-height:1.5}.internet-speed-guide:before{content:'속도 안내 · ';font-weight:900;color:var(--teal)}.internet-availability-note{background:#fff8e8;border-color:#f0deb1;color:#725c28}.internet-availability-note[hidden]{display:none}
.wired-quote-memory{margin-top:15px;padding:14px;border:1px solid #d5e3e5;border-radius:14px;background:#f8fbfb}.wired-quote-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.wired-quote-head>div{display:grid;gap:2px}.wired-quote-head span,.wired-recent-title{font-size:.66rem;color:var(--muted);font-weight:800}.wired-quote-head strong{font-size:.88rem;color:var(--navy)}.wired-quote-head button{min-height:36px;border:1px solid #cddcdf;border-radius:10px;background:#fff;color:var(--navy);font-weight:900}.wired-recent-title{margin:12px 0 6px}.wired-recent-list{display:grid;gap:6px}.wired-recent-list>p{margin:0!important;font-size:.7rem!important;color:var(--muted)!important}.wired-recent-list button{display:grid;grid-template-columns:auto 1fr auto;gap:7px;align-items:center;text-align:left;border:1px solid #d9e5e7;border-radius:10px;background:#fff;padding:9px;color:var(--ink)}.wired-recent-list button span{font-size:.6rem;color:var(--teal);font-weight:900}.wired-recent-list button strong{font-size:.69rem}.wired-recent-list button small{font-size:.65rem;color:var(--muted)}.wired-quote-tools{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}.wired-quote-tools button{min-height:40px;border:1px solid #cddcdf;border-radius:10px;background:#fff;color:var(--navy);font-weight:900}.wired-quote-tools button.primary{background:var(--navy);border-color:var(--navy);color:#fff}.wired-quote-tools small{grid-column:1/-1;min-height:1em;color:var(--teal);font-size:.66rem}
@media(max-width:900px){.wired-compare-results{grid-template-columns:1fr 1fr}}
@media(max-width:760px){.wired-compare-tool{padding:16px;border-radius:17px}.wired-compare-head{align-items:stretch;flex-direction:column}.wired-compare-controls,.wired-compare-results{grid-template-columns:1fr}.wired-compare-controls{min-width:0}.wired-compare-card>p{min-height:0}.wired-recent-list button{grid-template-columns:1fr}.wired-quote-tools{grid-template-columns:1fr 1fr}}
'''
if '/* Wired consultation v3 */' not in css: css+=css_add
CSS.write_text(css,encoding='utf-8')

# Basic validation.
for path in (HTML,JS,CSS):
    text=path.read_text(encoding='utf-8')
    if 'wired-compare-tool' not in (html+js+css): raise SystemExit('wired compare missing')
if '정책표' in html or '경품가이드' in html or '수수료(부가세별도)' in html:
    raise SystemExit('internal source wording leaked to customer HTML')
print('wired consultation v3 patch complete')
