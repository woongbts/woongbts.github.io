(() => {
  'use strict';

  const grid = document.getElementById('product-grid');
  if (!grid) return;

  const searchInput = document.getElementById('catalog-search');
  const brandFilters = document.getElementById('brand-filters');
  const categoryFilter = document.getElementById('category-filter');
  const featureFilters = document.getElementById('feature-filters');
  const budgetFilter = document.getElementById('catalog-budget-filter');
  const managementFilter = document.getElementById('catalog-management-filter');
  const termFilter = document.getElementById('catalog-term-filter');
  const catalogSort = document.getElementById('catalog-sort');
  const catalogReset = document.getElementById('catalog-reset');
  const count = document.getElementById('catalog-count');
  const moreBtn = document.getElementById('catalog-more');
  const catalogToggle = document.getElementById('catalog-toggle');
  const catalogPanel = document.getElementById('catalog-panel');
  const recommendTabs = document.getElementById('recommend-tabs');
  const recommendGrid = document.getElementById('recommend-grid');
  const recommendSort = document.getElementById('recommend-sort');
  const recommendProgress = document.getElementById('recommend-progress');
  const applianceMore = document.getElementById('appliance-more');
  const applianceGrid = document.querySelector('.appliance-grid');
  const recentSection = document.getElementById('recently-viewed');
  const recentGrid = document.getElementById('recent-grid');

  const PAGE_SIZE = window.matchMedia('(max-width:560px)').matches ? 8 : 12;
  const RECOMMEND_CATEGORIES = ['정수기','공기청정기','비데·연수기','안마의자','매트리스·프레임'];
  // Water purifier main-card lineup: premium choices plus one affordable and one mid-range.
  // These are only preferred defaults; category tabs and monthly/gift sorting still work.
  const WATER_PURIFIER_HOME_IDS = ['chp-7220n','clover-2242','clover-2254','clover-1702'];
  let recommendCategory = '정수기';
  let recommendSortMode = 'recommend';
  const state = { query: '', brand: '', category: '', feature: '', budget: 0, management: '', term: '', sort: 'recommend', limit: PAGE_SIZE };
  let products = [];
  let catalogLoaded = false;
  let catalogLoading = null;
  let filtersReady = false;
  let salesSignals = new Map();
  const RECENT_KEY = 'wb_rental_recent_v1';
  const COMPARE_KEY = 'wb_rental_compare_v1';

  const won = n => Number(n).toLocaleString('ko-KR') + '원';
  const IMAGE_REV = '20261013-productcuts4';
  const RENTAL_ENTRY_KEY = 'wb_rental_entry_v1';
  const rentalAnalyticsPath = product => '/rental/product/' + encodeURIComponent(String(product?.id || 'unknown'));
  function rememberRentalEntry(entry) {
    try { sessionStorage.setItem(RENTAL_ENTRY_KEY, entry); } catch (_) {}
  }
  function trackRental(type, product, detail = {}) {
    if (typeof window.woongbiTrackConversion !== 'function') return;
    window.woongbiTrackConversion(type, {
      ...detail,
      product_id: product?.id || '',
      analyticsPath: product ? rentalAnalyticsPath(product) : '/rental/'
    });
  }
  const policyMonthText = value => {
    const m = String(value || '').match(/^(\d{4})-(\d{2})/);
    return m ? `${m[1]}년 ${Number(m[2])}월 기준` : '최신 정책 기준';
  };
  function applyPolicyMonth(value) {
    const text = policyMonthText(value);
    const raw = String(value||'').slice(0,10);
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(raw+'T00:00:00') : null;
    const age = parsed && !Number.isNaN(parsed.getTime()) ? Math.floor((Date.now()-parsed.getTime())/86400000) : null;
    const fullText = text + (/^\d{4}-\d{2}-\d{2}$/.test(raw) ? ' · 자료갱신 '+raw.replace(/-/g,'.') : '');
    document.querySelectorAll('[data-policy-month]').forEach(el => {
      el.textContent = fullText + (Number.isFinite(age) && age>45?' · 최신 조건 상담 필수':'');
      el.classList.toggle('is-stale',Number.isFinite(age) && age>45);
    });
  }
  const localImageUrl = src => {
    const value = String(src || '').trim();
    if (!value) return '';
    if (value.startsWith('assets/product-images/')) return '/rental/' + value + '?v=' + IMAGE_REV;
    return value;
  };
  const productHref = product => product?.id ? 'product/' + encodeURIComponent(String(product.id)) + '/' : (product?.page || '#');
  const imageCandidatesFor = product => {
    const raw = [product.image, product.imageSourceOriginal].filter(Boolean);
    const candidates = [];
    raw.forEach(src => {
      const value = String(src || '').trim();
      if (!value) return;
      const resolved = localImageUrl(value);
      if (resolved && !candidates.includes(resolved)) candidates.push(resolved);
      if (value.startsWith('assets/product-images/')) {
        const mirror = 'https://raw.githubusercontent.com/woongbts/woongbts.github.io/main/rental/' + value + '?v=' + IMAGE_REV;
        if (!candidates.includes(mirror)) candidates.push(mirror);
      }
      if (/^https:\/\/storage\.bilrigo\.com\/data\/thumbnails\//i.test(value)) {
        const proxy = 'https://images.weserv.nl/?url=' + encodeURIComponent(value.replace(/^https?:\/\//, '')) + '&w=900&output=webp';
        if (!candidates.includes(proxy)) candidates.push(proxy);
      }
    });
    return candidates;
  };
  const brandLabel = brand => ({
    'COWAY':'코웨이',
    'CUCKOO':'쿠쿠',
    'LG퓨리케어':'LG 퓨리케어'
  }[brand] || brand || '');

  const featureDefs = [
    {key:'ice', label:'얼음', test:text => /얼음/.test(text)},
    {key:'direct', label:'직수', test:text => /직수/.test(text)},
    {key:'hotcold', label:'냉온', test:text => /냉온|냉수·온수/.test(text)},
    {key:'self', label:'셀프관리', test:text => /셀프|자가관리/.test(text)},
    {key:'pet', label:'펫', test:text => /펫/.test(text)},
    {key:'large', label:'대용량', test:text => /대용량/.test(text)}
  ];

  function isSellableOption(option) {
    const text = [option?.managementLabel, option?.sourceOption, option?.care].filter(Boolean).join(' ');
    return !/(?:^|\s)단종\//.test(text);
  }

  function applyCatalogOverrides(list, overrideData) {
    const overrides = overrideData?.products || {};
    list.forEach(product => {
      const override = overrides[product.id];
      if (override) Object.assign(product, override);
    });
    return list;
  }

  function optionLabel(value) {
    let x = String(value || '').trim();
    if (!x) return '';
    x = x.replace(/^단종\//, '');
    x = x.replace(/^기본 조건$/, '기본 옵션');
    x = x.replace(/^방문형(?=$|[·/)]|\s)/, '방문관리');
    x = x.replace(/^셀프형(?=$|[·/)]|\s)/, '셀프관리');
    x = x.replace(/^(방문관리|셀프관리)\)\d+개월$/, '$1');
    x = x.replace(/^관리형$/, '관리형');
    x = x.replace(/^킹\(K$/, '킹').replace(/^퀸\(Q$/, '퀸').replace(/^슈퍼싱글\(SS$/, '슈퍼싱글');
    x = x.replace(/^토탈케어\((라지킹|킹|퀸|슈퍼싱글|싱글)$/, '토탈케어 · $1');
    x = x.replace(/6개월\s*반값할인/g, '6개월 반값').replace(/10개월\s*반값할인/g, '10개월 반값');
    x = x.replace(/\/+/g, ' · ').replace(/\s*·\s*/g, ' · ').replace(/\s+/g, ' ').trim();
    if (x === '슬러지통x') return '슬러지통 없음';
    if (x === '슬러지통o') return '슬러지통 있음';
    return x;
  }

  function visual(product) {
    const placeholder = '<div class="catalog-image-placeholder"><span class="placeholder-mark">W</span><strong>이미지 불러오는 중</strong><small>' + (product.model || '') + '</small></div>';
    if (!product.image && !product.imageSourceOriginal) {
      return '<div class="catalog-image-slot">' + placeholder.replace('이미지 불러오는 중', '상품 이미지 준비 중') + '</div>';
    }
    return '<div class="catalog-image-slot">' +
      '<img class="catalog-product-image" data-product-id="' + product.id + '" alt="' + product.name + '" loading="eager" decoding="async">' +
      placeholder +
      '</div>';
  }

  function bindCatalogImages() {
    grid.querySelectorAll('.catalog-product-image').forEach(img => {
      const product = products.find(p => String(p.id) === String(img.dataset.productId));
      const placeholder = img.nextElementSibling;
      if (!product) return;

      const candidates = imageCandidatesFor(product);

      let index = 0;
      const showPlaceholder = () => {
        img.classList.remove('is-ready');
        if (placeholder) placeholder.hidden = false;
      };
      const tryNext = () => {
        index += 1;
        if (index < candidates.length) {
          img.src = candidates[index];
        } else {
          showPlaceholder();
          if (placeholder) {
            const status = placeholder.querySelector('strong');
            if (status) status.textContent = '상품 이미지 확인 중';
          }
          img.removeAttribute('src');
        }
      };

      img.addEventListener('load', () => {
        if (img.naturalWidth > 0) {
          img.classList.add('is-ready');
          if (placeholder) placeholder.hidden = true;
        } else {
          tryNext();
        }
      });

      img.addEventListener('error', tryNext);
      showPlaceholder();

      if (candidates.length) {
        img.src = candidates[0];
      }
    });
  }

  function renderProduct(product) {
    const validOptions = Array.isArray(product.options) ? product.options.filter(o => isSellableOption(o) && Number.isFinite(Number(o.monthly))) : [];
    const pairedOffer = recommendationMetrics(product);
    const minMonthly = pairedOffer?.minMonthly ?? null;
    const maxGift = pairedOffer?.maxGift ?? null;
    const managements = [...new Set(validOptions.map(o => optionLabel(o.managementLabel)).filter(Boolean))].slice(0,3).join(' · ');
    const tags = (product.tags || []).slice(0, 5).map(t => '<span>' + t + '</span>').join('');
    const highlights = (product.highlights || []).slice(0, 4).map(t => '<li>' + t + '</li>').join('');

    return `
      <article class="catalog-card">
        <a class="catalog-visual" data-rental-product-id="${product.id}" data-rental-entry="catalog" href="${productHref(product)}" aria-label="${product.name} 상세보기">
          <span class="brand-label">${brandLabel(product.brand)}</span>
          ${visual(product)}
        </a>
        <div class="catalog-info">
          <div class="product-tags">${tags}</div>
          <h3>${product.name}</h3>
          <p class="model">${product.model || ''}</p>
          <p class="catalog-description">${product.shortDescription || ''}</p>
          <ul class="catalog-highlights">${highlights}</ul>
          <div class="catalog-prices">
            <div><small>월 렌탈료</small><strong>${minMonthly == null ? '상담 확인' : won(minMonthly) + '부터'}</strong></div>
            <div class="gift"><small>같은 조건 고객사은품</small><strong>${maxGift == null ? '상담 확인' : won(maxGift)}</strong></div>
          </div>
          <p class="catalog-paired-note">※ 위 월요금·사은품은 동일 옵션 기준이며, 계약기간·관리방식은 상세페이지에서 확인하세요.</p>
          <p class="promo">${product.promo || '최신 프로모션 상담 확인'}</p>
          <p class="catalog-meta">${managements || '상세 조건 확인'}</p>
          <button class="compare-toggle" type="button" data-compare-product="${product.id}">비교담기</button>
          <div class="product-actions">
            <a class="btn primary" data-rental-product-id="${product.id}" data-rental-entry="catalog" href="${productHref(product)}">조건별 금액 보기</a>
            <a class="btn ghost" href="https://pf.kakao.com/_xbrVrxb" target="_blank" rel="noopener noreferrer">바로 상담</a>
          </div>
        </div>
      </article>
    `;
  }

  const BRAND_PREFERENCE = [
    {rank:1, label:'고객선호 1순위', test:b => /coway|코웨이/i.test(b)},
    {rank:2, label:'고객선호 2순위', test:b => /퓨리케어|lg/i.test(b)},
    {rank:3, label:'고객선호 3순위', test:b => /sk매직|sk magic/i.test(b)},
    {rank:4, label:'고객선호 4순위', test:b => /cuckoo|쿠쿠/i.test(b)}
  ];

  function brandPreference(product) {
    const brand = String(product.brand || '');
    return BRAND_PREFERENCE.find(x => x.test(brand)) || {rank:99, label:''};
  }

  // Customer-facing monthly price and gift MUST belong to the same contract.
  function recommendationMetrics(product) {
    const validOptions = Array.isArray(product.options)
      ? product.options.filter(o => isSellableOption(o) && Number.isFinite(Number(o.monthly)) && Number(o.monthly) >= 0)
      : [];
    if (!validOptions.length) return null;
    const candidate = [...validOptions].sort((a,b) =>
      Number(a.monthly)-Number(b.monthly) ||
      (Number.isFinite(Number(b.gift))?Number(b.gift):-1) - (Number.isFinite(Number(a.gift))?Number(a.gift):-1)
    )[0];
    const gift = candidate.gift == null || candidate.gift === '' ? null : Number(candidate.gift);
    return {
      minMonthly:Number(candidate.monthly),
      maxGift:Number.isFinite(gift) && gift>=0 ? gift : null,
      term:candidate.term,
      management:candidate.managementLabel || candidate.management || '',
      optionKey:candidate.key || ''
    };
  }

  function monthlyComfortLimit(category) {
    return ({
      '정수기':45000,
      '공기청정기':40000,
      '비데·연수기':30000,
      '안마의자':120000,
      '매트리스·프레임':65000
    }[category] || 50000);
  }

  function recommendationScore(product) {
    const m = recommendationMetrics(product);
    if (!m) return -1;
    const limit = monthlyComfortLimit(product.category);
    const over = Math.max(0, m.minMonthly - limit);
    // High gift is rewarded, while a high monthly fee is penalized more strongly
    // once it crosses a comfortable price band for that product category.
    const signal = salesSignals.get(String(product.id));
    const salesBoost = signal
      ? Math.min(12000, Number(signal.completed || 0) * 2500 + Math.min(4000, Number(signal.conversion || 0) * 40))
      : 0;
    return m.maxGift - (m.minMonthly * 1.55) - (over * 4.5) + salesBoost;
  }

  function recommendationCard(product) {
    const m = recommendationMetrics(product);
    const minMonthly = m?.minMonthly ?? null;
    const maxGift = m?.maxGift ?? null;
    const image = imageCandidatesFor(product)[0] || '';
    // Open the exact contract option shown on the recommendation card.
    const href = productHref(product) + (m?.management && m?.term
      ? '?mgmt=' + encodeURIComponent(m.management) + '&term=' + encodeURIComponent(m.term)
      : '');
    return `
      <article class="recommend-card">
        <a class="recommend-image" data-rental-product-id="${product.id}" data-rental-entry="recommend" href="${href}">
          ${image ? '<img src="' + image + '" alt="' + product.name + '" loading="lazy" decoding="async">' : '<span class="recommend-fallback">W</span>'}
        </a>
        <div class="recommend-body">
          <div class="recommend-meta">
            <small>${brandLabel(product.brand)} · ${product.model || product.category || ''}</small>
          </div>
          <h3>${product.name}</h3>
          <div class="recommend-prices">
            <span>월 ${minMonthly == null ? '상담 확인' : won(minMonthly) + '부터'}</span>
            <strong>${maxGift == null ? '사은품 상담 확인' : '같은 조건 사은품 ' + won(maxGift)}</strong>
          </div>
          <small class="catalog-paired-note">동일 계약조건 기준 · 다른 옵션은 상세페이지에서 확인</small>
          <div class="recommend-actions"><a class="recommend-link" data-rental-product-id="${product.id}" data-rental-entry="recommend" href="${href}">조건 보기 →</a><button class="compare-toggle small" type="button" data-compare-product="${product.id}">비교담기</button></div>
        </div>
      </article>
    `;
  }

  function renderRecommendations() {
    if (!recommendTabs || !recommendGrid) return;
    const available = RECOMMEND_CATEGORIES.filter(category =>
      products.some(p => p.category === category && p.availability !== 'inactive' && recommendationScore(p) >= 0)
    );
    if (!available.length) {
      recommendTabs.hidden = true;
      recommendGrid.innerHTML = '';
      return;
    }
    if (!available.includes(recommendCategory)) recommendCategory = available[0];
    recommendTabs.innerHTML = available.map(category =>
      '<button type="button" role="tab" aria-selected="' + (category === recommendCategory ? 'true' : 'false') + '" class="' + (category === recommendCategory ? 'active' : '') + '" data-recommend-category="' + category + '">' + category + '</button>'
    ).join('');
    recommendTabs.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        recommendCategory = btn.dataset.recommendCategory || available[0];
        renderRecommendations();
      });
    });

    const candidates = products
      .filter(p => p.category === recommendCategory && p.availability !== 'inactive')
      .filter(p => !/단종|접수불가|접수중지/.test(String(p.name || '')))
      .filter(p => recommendationScore(p) >= 0);

    if (recommendSort) {
      recommendSort.querySelectorAll('button').forEach(btn => {
        const mode = btn.dataset.recommendSort || 'recommend';
        const active = mode === recommendSortMode;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        btn.onclick = () => {
          recommendSortMode = mode;
          renderRecommendations();
        };
      });
    }

    let selected = [];

    if (recommendSortMode === 'monthly') {
      selected = [...candidates]
        .sort((a,b) => {
          const am = recommendationMetrics(a);
          const bm = recommendationMetrics(b);
          return (am?.minMonthly ?? Infinity) - (bm?.minMonthly ?? Infinity)
            || brandPreference(a).rank - brandPreference(b).rank
            || recommendationScore(b) - recommendationScore(a);
        })
        .slice(0, 4);
    } else if (recommendSortMode === 'gift') {
      selected = [...candidates]
        .sort((a,b) => {
          const am = recommendationMetrics(a);
          const bm = recommendationMetrics(b);
          return (bm?.maxGift ?? -1) - (am?.maxGift ?? -1)
            || (am?.minMonthly ?? Infinity) - (bm?.minMonthly ?? Infinity)
            || brandPreference(a).rank - brandPreference(b).rank;
        })
        .slice(0, 4);
    } else {
      // Keep the original first two cards and explicitly display the affordable
      // CUCKOO and mid-priced SK Magic options in the third/fourth slots.
      if (recommendCategory === '정수기') {
        selected = WATER_PURIFIER_HOME_IDS
          .map(id => candidates.find(p => String(p.id) === id))
          .filter(Boolean);
      }
      const preferredGroups = BRAND_PREFERENCE.map(pref => ({
        pref,
        items: candidates
          .filter(p => pref.test(String(p.brand || '')))
          .sort((a,b) => recommendationScore(b) - recommendationScore(a))
      }));

      // Fill only missing slots so disabled or removed products never leave gaps.
      preferredGroups.forEach(group => {
        if (selected.length >= 4) return;
        const next = group.items.find(item => !selected.includes(item));
        if (next) selected.push(next);
      });

      // 해당 품목에 선호 브랜드가 없으면 남은 상품 중 조건 균형이 좋은 순서로 채운다.
      if (selected.length < 4) {
        candidates
          .filter(p => !selected.includes(p))
          .sort((a,b) => {
            const brandDiff = brandPreference(a).rank - brandPreference(b).rank;
            return brandDiff || (recommendationScore(b) - recommendationScore(a));
          })
          .forEach(p => {
            if (selected.length < 4) selected.push(p);
          });
      }
    }

    // Keep the first two trusted picks; use one affordable cold/hot model
    // and one entry-level sterilizing purifier in the lower two positions.
    if (recommendCategory === '정수기' && recommendSortMode === 'recommend' && selected.length >= 2) {
      const sk = candidates.find(p => p.id === 'clover-2202' &&
        recommendationMetrics(p)?.minMonthly >= 30000 && recommendationMetrics(p)?.minMonthly < 50000);
      const cuckoo = candidates.find(p => p.id === 'clover-2197' &&
        recommendationMetrics(p)?.minMonthly >= 10000 && recommendationMetrics(p)?.minMonthly < 30000);
      if (sk && cuckoo && !selected.slice(0, 2).some(p => p.id === sk.id || p.id === cuckoo.id)) {
        selected = [...selected.slice(0, 2), sk, cuckoo];
      }
    }

    recommendGrid.innerHTML = selected.map(recommendationCard).join('');
    bindRecommendProgress();
  }


  function updateRecommendProgress() {
    if(!recommendProgress||!recommendGrid)return;
    const cards=[...recommendGrid.querySelectorAll('.recommend-card')];
    const mobile=window.matchMedia('(max-width:560px)').matches;
    recommendProgress.hidden=!mobile||cards.length<=1;
    if(!mobile||cards.length<=1)return;
    const gridRect=recommendGrid.getBoundingClientRect();
    let current=0,best=Infinity;
    cards.forEach((card,index)=>{
      const d=Math.abs(card.getBoundingClientRect().left-gridRect.left);
      if(d<best){best=d;current=index;}
    });
    const label=recommendProgress.querySelector('span');
    const dots=recommendProgress.querySelector('.recommend-dots');
    if(label)label.textContent=(current+1)+' / '+cards.length;
    if(dots)dots.innerHTML=cards.map((_,i)=>'<i class="'+(i===current?'active':'')+'"></i>').join('');
  }
  function bindRecommendProgress() {
    if(!recommendGrid)return;
    recommendGrid.onscroll=()=>requestAnimationFrame(updateRecommendProgress);
    requestAnimationFrame(updateRecommendProgress);
  }

  function summaryFor(product) {
    const m = recommendationMetrics(product) || {};
    return {
      id:product.id,name:product.name,model:product.model||'',brand:brandLabel(product.brand),
      category:product.category||'',page:productHref(product),image:imageCandidatesFor(product)[0]||'',
      minMonthly:m.minMonthly??null,maxGift:m.maxGift??null,
      terms:[...new Set((product.options||[]).map(o=>String(o.term||'')).filter(Boolean))],
      highlights:(product.highlights||[]).slice(0,3)
    };
  }
  function loadCompareIds(){try{return JSON.parse(localStorage.getItem(COMPARE_KEY)||'[]').filter(Boolean).slice(0,3)}catch(_){return[]}}
  function saveCompareIds(ids){try{localStorage.setItem(COMPARE_KEY,JSON.stringify(ids.slice(0,3)))}catch(_){}}
  function productById(id){return products.find(p=>String(p.id)===String(id))}
  function updateCompareUi(){
    const ids=loadCompareIds();
    document.querySelectorAll('[data-compare-product]').forEach(btn=>{
      const active=ids.includes(btn.dataset.compareProduct);
      btn.classList.toggle('active',active); btn.textContent=active?'비교담김':'비교담기';
    });
    let bar=document.getElementById('compare-bar');
    if(!ids.length){bar?.remove();return}
    if(!bar){bar=document.createElement('div');bar.id='compare-bar';bar.className='compare-bar';document.body.appendChild(bar)}
    const names=ids.map(id=>productById(id)?.name||id);
    bar.innerHTML='<div><small>비교 '+ids.length+'/3</small><strong>'+names.map(x=>String(x).replace(/</g,'&lt;')).join(' · ')+'</strong></div><button type="button" id="open-compare">비교하기</button><button type="button" id="clear-compare" aria-label="비교목록 비우기">×</button>';
  }
  function toggleCompare(id){
    let ids=loadCompareIds();
    if(ids.includes(id)) ids=ids.filter(x=>x!==id);
    else if(ids.length<3) ids.push(id);
    else { alert('비교는 최대 3개까지 담을 수 있습니다.'); return; }
    saveCompareIds(ids); updateCompareUi();
  }
  function openCompareModal(){
    const rows=loadCompareIds().map(productById).filter(Boolean);
    if(!rows.length)return;
    let modal=document.getElementById('compare-modal');
    if(!modal){modal=document.createElement('div');modal.id='compare-modal';modal.className='compare-modal';document.body.appendChild(modal)}
    const metrics=rows.map(p=>{
      const m=recommendationMetrics(p)||{};
      const terms=[...new Set((p.options||[]).map(o=>o.term).filter(Boolean))];
      return {product:p,minMonthly:m.minMonthly??null,maxGift:m.maxGift??null,termCount:terms.length,featureCount:(p.highlights||[]).length};
    });
    const minMonthly=Math.min(...metrics.map(x=>x.minMonthly).filter(Number.isFinite));
    const maxGift=Math.max(...metrics.map(x=>x.maxGift).filter(Number.isFinite));
    const maxTermCount=Math.max(...metrics.map(x=>x.termCount));
    const strengthHtml=metrics.map(x=>{
      const badges=[];
      if(Number.isFinite(x.minMonthly)&&x.minMonthly===minMonthly)badges.push('월요금 최저');
      if(Number.isFinite(x.maxGift)&&x.maxGift===maxGift)badges.push('사은품 최대');
      if(x.termCount>1&&x.termCount===maxTermCount)badges.push('계약기간 선택 폭 넓음');
      if(!badges.length)badges.push('차이표에서 조건 확인');
      return '<article><strong>'+x.product.name+'</strong><div>'+badges.slice(0,3).map(b=>'<span>'+b+'</span>').join('')+'</div></article>';
    }).join('');
    const cell=(p,key)=>{
      const m=recommendationMetrics(p)||{};
      if(key==='brand')return brandLabel(p.brand)||'-';
      if(key==='monthly')return m.minMonthly==null?'상담 확인':won(m.minMonthly)+'부터';
      if(key==='gift')return m.maxGift==null?'상담 확인':'최대 '+won(m.maxGift);
      if(key==='term')return [...new Set((p.options||[]).map(o=>o.term).filter(Boolean))].map(x=>x+'개월').join(' / ')||'-';
      if(key==='feature')return (p.highlights||[]).slice(0,3).join(' · ')||p.category||'-';
      return '-';
    };
    const defs=[['브랜드','brand'],['월 렌탈료','monthly'],['고객사은품','gift'],['계약기간','term'],['주요 특징','feature']];
    const rowData=defs.map(([label,key])=>({label,key,values:rows.map(p=>cell(p,key))}));
    const diffRows=rowData.filter(row=>new Set(row.values.map(String)).size>1);
    const defaultRows=diffRows.length?diffRows:rowData;
    const head=rows.map(p=>'<th>'+p.name+'</th>').join('');
    const renderRows=list=>list.map(row=>'<tr><th>'+row.label+'</th>'+row.values.map(value=>'<td>'+value+'</td>').join('')+'</tr>').join('');
    modal.innerHTML='<div class="compare-backdrop" data-close-compare></div><section class="compare-panel" role="dialog" aria-modal="true" aria-label="렌탈상품 비교"><button class="compare-close" data-close-compare type="button">×</button><p class="eyebrow dark">상품 비교</p><div class="compare-title-row"><div><h2>서로 다른 조건부터 빠르게 보세요.</h2><p>같은 항목은 숨기고 결정에 필요한 차이와 각 상품의 강점을 먼저 보여드립니다.</p></div><button id="compare-diff-toggle" type="button" data-mode="diff">'+(diffRows.length?'전체 항목 보기':'차이 없음')+'</button></div><div class="compare-strengths">'+strengthHtml+'</div><div class="compare-diff-summary">'+diffRows.slice(0,3).map(row=>'<span><b>'+row.label+'</b> · '+row.values.join(' / ')+'</span>').join('')+'</div><div class="compare-table-wrap"><table><thead><tr><th>항목</th>'+head+'</tr></thead><tbody id="compare-table-body">'+renderRows(defaultRows)+'</tbody></table></div><div class="compare-links">'+rows.map(p=>'<a class="btn primary" href="'+productHref(p)+'">'+p.name+' 조건 보기</a>').join('')+'</div></section>';
    const toggle=modal.querySelector('#compare-diff-toggle');
    if(toggle&&diffRows.length){
      toggle.addEventListener('click',()=>{
        const all=toggle.dataset.mode==='all';
        toggle.dataset.mode=all?'diff':'all';
        toggle.textContent=all?'전체 항목 보기':'차이만 보기';
        const body=modal.querySelector('#compare-table-body');
        if(body)body.innerHTML=renderRows(all?diffRows:rowData);
      });
    }else if(toggle){toggle.disabled=true}
    modal.classList.add('open');
  }
  function renderRecent(){
    if(!recentSection||!recentGrid)return;
    let list=[];try{list=JSON.parse(localStorage.getItem(RECENT_KEY)||'[]')}catch(_){}
    list=(Array.isArray(list)?list:[]).slice(0,5);
    recentSection.hidden=!list.length;
    recentGrid.innerHTML=list.map(p=>'<article class="recent-card"><a href="'+(p.id?('product/'+encodeURIComponent(String(p.id))+'/'):(p.page||'#'))+'">'+(p.image?'<img src="'+p.image+'" alt="" loading="lazy" decoding="async">':'<span class="recent-fallback">W</span>')+'<div><small>'+((p.brand||'')+(p.model?' · '+p.model:'')).replace(/</g,'&lt;')+'</small><strong>'+String(p.name||'상품').replace(/</g,'&lt;')+'</strong><span>'+(p.minMonthly!=null?'월 '+won(p.minMonthly)+'부터':'월요금 상담 확인')+' · '+(p.maxGift!=null?'사은품 최대 '+won(p.maxGift):'사은품 상담 확인')+'</span></div></a></article>').join('');
  }

  function openCatalog(scrollIntoView = false) {
    if (!catalogPanel) return;
    catalogPanel.hidden = false;
    if (catalogToggle) {
      catalogToggle.setAttribute('aria-expanded','true');
      catalogToggle.textContent = '전체 상품 닫기';
    }
    if (scrollIntoView) {
      requestAnimationFrame(() => document.getElementById('products')?.scrollIntoView({behavior:'smooth',block:'start'}));
    }
  }

  function closeCatalog() {
    if (!catalogPanel) return;
    catalogPanel.hidden = true;
    if (catalogToggle) {
      catalogToggle.setAttribute('aria-expanded','false');
      catalogToggle.textContent = '전체 상품 열기';
    }
  }

  function normalizeText(value) {
    return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function productText(product) {
    return normalizeText([
      product.brand,
      product.name,
      product.model,
      product.category,
      product.rawCategory,
      product.color,
      product.shortDescription,
      ...(product.tags || []),
      ...(product.highlights || [])
    ].join(' '));
  }

  function matchesBase(product) {
    if (state.brand && product.brand !== state.brand) return false;
    if (state.category && product.category !== state.category) return false;
    if (state.query && !productText(product).includes(normalizeText(state.query))) return false;
    return true;
  }

  function optionManagementMatches(option, mode) {
    if (!mode) return true;
    const text=[option?.management,option?.managementLabel,option?.care,option?.sourceOption].filter(Boolean).join(' ');
    return mode==='self' ? /자가|셀프|self/i.test(text) : /방문|visit/i.test(text);
  }

  function matches(product) {
    if (!matchesBase(product)) return false;
    if (state.feature) {
      const def = featureDefs.find(x => x.key === state.feature);
      if (def && !def.test(productText(product))) return false;
    }
    const valid=(product.options||[]).filter(o=>isSellableOption(o)&&Number.isFinite(Number(o.monthly)));
    if (state.budget) {
      const min=valid.length?Math.min(...valid.map(o=>Number(o.monthly))):Infinity;
      if (min>Number(state.budget)) return false;
    }
    if (state.management && !valid.some(o=>optionManagementMatches(o,state.management))) return false;
    if (state.term && !valid.some(o=>String(o.term)===String(state.term))) return false;
    return true;
  }

  function filteredProducts() {
    const list=products.filter(p => p.availability !== 'inactive').filter(matches);
    return [...list].sort((a,b)=>{
      const am=recommendationMetrics(a)||{},bm=recommendationMetrics(b)||{};
      if(state.sort==='monthly') return (am.minMonthly??Infinity)-(bm.minMonthly??Infinity) || brandPreference(a).rank-brandPreference(b).rank;
      if(state.sort==='gift') return (bm.maxGift??-1)-(am.maxGift??-1) || (am.minMonthly??Infinity)-(bm.minMonthly??Infinity);
      if(state.sort==='brand') return brandPreference(a).rank-brandPreference(b).rank || brandLabel(a.brand).localeCompare(brandLabel(b.brand),'ko') || String(a.name).localeCompare(String(b.name),'ko');
      return recommendationScore(b)-recommendationScore(a) || brandPreference(a).rank-brandPreference(b).rank || (am.minMonthly??Infinity)-(bm.minMonthly??Infinity);
    });
  }

  function renderFeatureFilters() {
    if (!featureFilters) return;
    const base = products.filter(p => p.availability !== 'inactive').filter(matchesBase);
    if (state.feature) {
      const activeDef = featureDefs.find(x => x.key === state.feature);
      if (!activeDef || !base.some(p => activeDef.test(productText(p)))) state.feature = '';
    }
    featureFilters.innerHTML = [
      '<button type="button" class="' + (!state.feature ? 'active' : '') + '" data-feature="">전체 기능</button>',
      ...featureDefs.map(def => {
        const n = base.filter(p => def.test(productText(p))).length;
        return n ? '<button type="button" class="' + (state.feature === def.key ? 'active' : '') + '" data-feature="' + def.key + '">' + def.label + '<small>' + n + '</small></button>' : '';
      }).filter(Boolean)
    ].join('');
    featureFilters.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        state.feature = btn.dataset.feature || '';
        resetAndRender();
      });
    });
  }

  function render() {
    renderFeatureFilters();
    const filtered = filteredProducts();
    const visible = filtered.slice(0, state.limit);

    grid.innerHTML = visible.length
      ? visible.map(renderProduct).join('')
      : '<p class="catalog-error">조건에 맞는 상품이 없습니다. 검색어나 필터를 바꿔보세요.</p>';
    if (visible.length) bindCatalogImages();
    grid.removeAttribute('aria-busy');

    if (count) {
      count.textContent = filtered.length
        ? '전체 ' + filtered.length.toLocaleString('ko-KR') + '개 중 ' + visible.length.toLocaleString('ko-KR') + '개 표시'
        : '검색 결과 0개';
    }

    if (moreBtn) {
      const remaining = Math.max(0, filtered.length - visible.length);
      moreBtn.hidden = remaining === 0;
      moreBtn.textContent = remaining
        ? '상품 더보기 · ' + Math.min(PAGE_SIZE, remaining).toLocaleString('ko-KR') + '개'
        : '';
    }
  }

  function resetAndRender() {
    state.limit = PAGE_SIZE;
    render();
  }

  function handleDirectSectionHash() {
    const hash = window.location.hash || '';
    if (hash === '#recommendations') recommendCategory = '정수기';
  }

  function setupFilters() {
    if (filtersReady) return;
    filtersReady = true;
    const activeProducts = products.filter(p => p.availability !== 'inactive');
    const brands = [...new Set(activeProducts.map(p => p.brand).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'ko'));
    const categories = [...new Set(activeProducts.map(p => p.category).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'ko'));

    document.querySelectorAll('[data-category-link]').forEach(link => {
      link.hidden = !categories.includes(link.dataset.categoryLink || '');
    });

    if (brandFilters) {
      brandFilters.innerHTML = [
        '<button type="button" class="active" data-brand="">전체</button>',
        ...brands.map(brand => '<button type="button" data-brand="' + brand + '">' + brandLabel(brand) + '</button>')
      ].join('');

      brandFilters.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          state.brand = btn.dataset.brand || '';
          brandFilters.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === btn));
          resetAndRender();
        });
      });
    }

    if (categoryFilter) {
      categoryFilter.innerHTML = '<option value="">전체 카테고리</option>' +
        categories.map(category => '<option value="' + category + '">' + category + '</option>').join('');
      categoryFilter.addEventListener('change', () => {
        state.category = categoryFilter.value;
        document.querySelectorAll('[data-category-link]').forEach(link => {
          link.classList.toggle('active', link.dataset.categoryLink === state.category);
        });
        resetAndRender();
      });
    }

    const terms=[...new Set(activeProducts.flatMap(p=>(p.options||[]).filter(isSellableOption).map(o=>Number(o.term))).filter(Number.isFinite))].sort((a,b)=>a-b);
    if(termFilter) termFilter.innerHTML='<option value="">전체</option>'+terms.map(term=>'<option value="'+term+'">'+term+'개월</option>').join('');

    searchInput?.addEventListener('input', () => {
      state.query = searchInput.value;
      if (state.feature && !featureDefs.some(def => def.key === state.feature)) state.feature = '';
      resetAndRender();
    });
    budgetFilter?.addEventListener('change',()=>{state.budget=Number(budgetFilter.value)||0;resetAndRender();trackRental('rental_catalog_filter',null,{filter:'budget',value:budgetFilter.value||'all'});});
    managementFilter?.addEventListener('change',()=>{state.management=managementFilter.value||'';resetAndRender();trackRental('rental_catalog_filter',null,{filter:'management',value:state.management||'all'});});
    termFilter?.addEventListener('change',()=>{state.term=termFilter.value||'';resetAndRender();trackRental('rental_catalog_filter',null,{filter:'term',value:state.term||'all'});});
    catalogSort?.addEventListener('change',()=>{state.sort=catalogSort.value||'recommend';resetAndRender();trackRental('rental_catalog_sort',null,{sort:state.sort});});
    catalogReset?.addEventListener('click',()=>{
      state.query='';state.brand='';state.category='';state.feature='';state.budget=0;state.management='';state.term='';state.sort='recommend';
      if(searchInput)searchInput.value='';
      if(categoryFilter)categoryFilter.value='';
      if(budgetFilter)budgetFilter.value='';
      if(managementFilter)managementFilter.value='';
      if(termFilter)termFilter.value='';
      if(catalogSort)catalogSort.value='recommend';
      brandFilters?.querySelectorAll('button').forEach(btn=>btn.classList.toggle('active',!btn.dataset.brand));
      document.querySelectorAll('[data-category-link]').forEach(link=>link.classList.remove('active'));
      resetAndRender();
    });

    moreBtn?.addEventListener('click', () => {
      state.limit += PAGE_SIZE;
      render();
    });

  }

  async function loadFullCatalog() {
    if (catalogLoaded) return products;
    if (catalogLoading) return catalogLoading;
    catalogLoading = Promise.all([
      fetch('data/products.json', {cache:'no-store'}).then(r => { if(!r.ok) throw new Error('catalog fetch failed'); return r.json(); }),
      fetch('data/appliance-gift-options.json', {cache:'no-store'}).then(r => r.ok ? r.json() : null).catch(()=>null),
      fetch('data/catalog-overrides.json', {cache:'no-store'}).then(r => r.ok ? r.json() : null).catch(()=>null),
      fetch('https://woongbi-consent.woongbts.workers.dev/api/recommendation-signals',{cache:'no-store',credentials:'omit'}).then(r=>r.ok?r.json():null).catch(()=>null)
    ]).then(([data,giftData,overrideData,signalData]) => {
      salesSignals = new Map((signalData?.signals?.rental || []).map(row => [String(row.product_id), row]));
      products = Array.isArray(data.products) ? data.products.filter(p=>p.availability!=='inactive'&&!/접수불가|접수중지/.test(String(p.name||''))) : [];
      applyCatalogOverrides(products, overrideData);
      const overrides=giftData?.products||{};
      products.forEach(p=>{const ov=overrides[p.id];if(ov&&p.sourceKind==='clover-import')Object.assign(p,ov)});
      applyPolicyMonth(giftData?.generatedAt||data?.updatedAt||'');
      catalogLoaded=true;
      setupFilters();
      render();
      renderRecommendations();
      updateCompareUi();
      return products;
    }).catch(error=>{
      grid.innerHTML='<p class="catalog-error">상품 정보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</p>';
      grid.removeAttribute('aria-busy'); throw error;
    }).finally(()=>{catalogLoading=null});
    return catalogLoading;
  }

  window.woongbiRentalCompare = {
    async toggle(id) {
      toggleCompare(String(id || ''));
      return loadCompareIds();
    },
    async open() {
      await loadFullCatalog();
      updateCompareUi();
      openCompareModal();
      return loadCompareIds();
    },
    ids() {
      return loadCompareIds();
    }
  };

  // Homepage quick finder: reuse existing filters, prices and official product links.
  const quickFinderForm = document.getElementById('rental-fast-find-form');
  const quickFinderInput = document.getElementById('rental-fast-find-input');
  const quickFinderStatus = document.getElementById('rental-fast-find-status');
  async function launchQuickFinder(options = {}) {
    const query = String(options.query || '').trim();
    const category = String(options.category || '').trim();
    if (quickFinderStatus) quickFinderStatus.textContent = '등록상품을 확인하고 있습니다…';
    try {
      await loadFullCatalog();
      state.query = query;
      state.category = category;
      state.brand = '';
      state.feature = '';
      state.budget = 0;
      state.management = '';
      state.term = '';
      state.sort = 'recommend';
      if (searchInput) searchInput.value = query;
      if (categoryFilter) categoryFilter.value = category;
      if (budgetFilter) budgetFilter.value = '';
      if (managementFilter) managementFilter.value = '';
      if (termFilter) termFilter.value = '';
      if (catalogSort) catalogSort.value = 'recommend';
      brandFilters?.querySelectorAll('button').forEach(btn => btn.classList.toggle('active', !btn.dataset.brand));
      document.querySelectorAll('[data-category-link]').forEach(link => link.classList.toggle('active', link.dataset.categoryLink === category));
      openCatalog(true);
      resetAndRender();
      if (quickFinderStatus) quickFinderStatus.textContent = query
        ? '“' + query + '” 검색 결과를 아래 상품 목록에서 확인하세요.'
        : category ? category + ' 상품을 아래 목록에서 확인하세요.' : '등록된 전체 상품을 아래에서 확인하세요.';
      trackRental('rental_catalog_search',null,{entry:'homepage_quick_search',category:category||'all'});
      requestAnimationFrame(() => searchInput?.focus({preventScroll:true}));
    } catch (_) {
      if (quickFinderStatus) quickFinderStatus.textContent = '상품 목록을 불러오지 못했습니다. 잠시 후 다시 시도하거나 전화로 상담해 주세요.';
    }
  }
  quickFinderForm?.addEventListener('submit', event => {
    event.preventDefault();
    void launchQuickFinder({query:quickFinderInput?.value||''});
  });
  document.querySelectorAll('[data-quick-rental-category]').forEach(button => {
    button.addEventListener('click', () => {
      if (quickFinderInput) quickFinderInput.value = '';
      void launchQuickFinder({category:button.dataset.quickRentalCategory||'',query:button.dataset.quickRentalQuery||''});
    });
  });

  catalogToggle?.addEventListener('click', async () => {
    if (catalogPanel?.hidden) {
      await loadFullCatalog();
      openCatalog();
      trackRental('rental_catalog_open', null, {entry:'catalog'});
    } else closeCatalog();
  });
  document.querySelectorAll('[data-category-link]').forEach(link=>{
    link.addEventListener('click', async event=>{
      event.preventDefault();
      await loadFullCatalog();
      state.category=link.dataset.categoryLink||'';
      if(categoryFilter)categoryFilter.value=state.category;
      document.querySelectorAll('[data-category-link]').forEach(x=>x.classList.toggle('active',x.dataset.categoryLink===state.category));
      openCatalog(true); resetAndRender();
    });
  });
  applianceMore?.addEventListener('click', () => {
    const expanded=applianceGrid?.classList.toggle('is-expanded');
    applianceMore.setAttribute('aria-expanded',expanded?'true':'false');
    const hiddenCount=Math.max(0,(applianceGrid?.children.length||0)-6);
    applianceMore.textContent=expanded?'품목 접기':`다른 품목 ${hiddenCount}개 보기`;
  });
  if(applianceMore){const hiddenCount=Math.max(0,(applianceGrid?.children.length||0)-6);applianceMore.textContent=`다른 품목 ${hiddenCount}개 보기`}

  document.addEventListener('click', event => {
    const compareBtn=event.target.closest('[data-compare-product]');
    if(compareBtn){event.preventDefault();const id=String(compareBtn.dataset.compareProduct||'');toggleCompare(id);trackRental('rental_compare_toggle',productById(id)||null,{selected:loadCompareIds().includes(id),count:loadCompareIds().length});return}
    if(event.target.closest('#open-compare')){event.preventDefault();trackRental('rental_compare_open',null,{count:loadCompareIds().length});loadFullCatalog().then(()=>{updateCompareUi();openCompareModal();});return}
    if(event.target.closest('#clear-compare')){saveCompareIds([]);updateCompareUi();return}
    if(event.target.closest('[data-close-compare]')){document.getElementById('compare-modal')?.classList.remove('open');return}
    const link=event.target.closest('[data-rental-product-id]');
    if(!link)return;
    const productId=String(link.dataset.rentalProductId||''),entry=String(link.dataset.rentalEntry||'catalog');
    const target=productById(productId);if(!target)return;
    rememberRentalEntry(entry);
    trackRental(entry==='recommend'?'rental_recommend_click':'rental_catalog_product_click',target,{entry});
  });

  Promise.all([
    fetch('data/featured.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('featured fetch failed');return r.json()}),
    fetch('data/catalog-overrides.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null),
    fetch('https://woongbi-consent.woongbts.workers.dev/api/recommendation-signals',{cache:'no-store',credentials:'omit'}).then(r=>r.ok?r.json():null).catch(()=>null)
  ])
    .then(([data,overrideData,signalData])=>{
      // Quick search may have loaded the full catalog before featured data returns.
      if(catalogLoaded){renderRecent();updateCompareUi();return;}
      salesSignals = new Map((signalData?.signals?.rental || []).map(row => [String(row.product_id), row]));
      products=Array.isArray(data.products)?data.products:[];
      applyCatalogOverrides(products, overrideData);
      applyPolicyMonth(data.generatedAt||'');
      handleDirectSectionHash();
      renderRecommendations();
      renderRecent();
      updateCompareUi();
      if(location.hash==='#products') {
        const search = new URLSearchParams(location.search);
        const query = search.get('q') || '';
        const category = search.get('category') || '';
        return query || category ? launchQuickFinder({query,category}) : loadFullCatalog().then(()=>openCatalog());
      }
    })
    .catch(()=>loadFullCatalog().then(()=>{renderRecent();updateCompareUi();if(location.hash==='#products'){const params=new URLSearchParams(location.search);const q=params.get('q')||'',category=params.get('category')||'';if(q||category)void launchQuickFinder({query:q,category});else openCatalog();}}));
})();