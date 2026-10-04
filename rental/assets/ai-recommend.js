(() => {
  'use strict';

  const openButtons = document.querySelectorAll('[data-ai-recommend-open]');
  const dialog = document.getElementById('ai-recommend-dialog');
  if (!openButtons.length || !dialog) return;

  const closeBtn = document.getElementById('ai-recommend-close');
  const form = document.getElementById('ai-recommend-form');
  const categorySelect = document.getElementById('ai-category');
  const budgetSelect = document.getElementById('ai-budget');
  const brandSelect = document.getElementById('ai-brand');
  const managementSelect = document.getElementById('ai-management');
  const preferenceInput = document.getElementById('ai-preference');
  const results = document.getElementById('ai-recommend-results');
  const status = document.getElementById('ai-recommend-status');
  const budgetStrict = document.getElementById('ai-budget-strict');
  const brandStrict = document.getElementById('ai-brand-strict');
  const managementStrict = document.getElementById('ai-management-strict');
  const mustFeatureInputs = [...document.querySelectorAll('[data-ai-must-feature]')];

  let products = [];
  let loadPromise = null;
  let lastCriteria = null;
  let lastItems = [];
  let policyGeneratedAt = '';

  const KAKAO_CHAT_URL = 'http://pf.kakao.com/_nWwNT/chat';
  const COMPARE_KEY = 'wb_rental_compare_v1';
  const BRAND_ORDER = [
    { re: /coway|코웨이/i, rank: 1 },
    { re: /퓨리케어|^lg$/i, rank: 2 },
    { re: /sk매직|sk magic/i, rank: 3 },
    { re: /cuckoo|쿠쿠/i, rank: 4 }
  ];
  const CATEGORY_ORDER = [
    '정수기','공기청정기','비데·연수기','매트리스·프레임','안마의자',
    '세탁·건조·의류관리','냉장고·김치냉장고','TV·디지털','에어컨·청소기',
    '주방가전','생활가전','건강·뷰티','가구·침대','레저·자동차'
  ];
  const FEATURE_DEFS = {
    ice: { label:'얼음', re:/얼음|아이스/ },
    direct: { label:'직수', re:/직수/ },
    hotcold: { label:'냉온', re:/냉온|냉수|온수/ },
    slim: { label:'슬림·미니', re:/슬림|초소형|미니|작은|공간/ },
    large: { label:'대용량', re:/대용량|업소|사무실|매장/ }
  };

  const won = value => Number(value).toLocaleString('ko-KR') + '원';
  const escapeHtml = value => String(value ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  function brandLabel(brand) {
    return ({
      COWAY: '코웨이',
      CUCKOO: '쿠쿠',
      LG퓨리케어: 'LG 퓨리케어'
    }[brand] || brand || '');
  }

  function brandRank(brand) {
    const value = String(brand || '');
    return BRAND_ORDER.find(x => x.re.test(value))?.rank ?? 99;
  }

  function policyMonthText(value) {
    const m = String(value || '').match(/^(\d{4})-(\d{2})/);
    return m ? m[1] + '년 ' + Number(m[2]) + '월 정책 기준' : '최신 정책 기준';
  }

  function localImageUrl(src) {
    const value = String(src || '').trim();
    if (!value) return '';
    return value.startsWith('assets/product-images/') ? '/rental/' + value : value;
  }

  function cleanProductPath(product) {
    return 'product/' + encodeURIComponent(String(product?.id || '')) + '/';
  }

  function productUrl(product, option, apply = false) {
    const u = new URL(cleanProductPath(product), location.origin + '/rental/');
    u.searchParams.set('from', 'ai');
    if (option?.management) u.searchParams.set('mgmt', String(option.management));
    if (option?.term != null) u.searchParams.set('term', String(option.term));
    if (apply) u.searchParams.set('apply', '1');
    return u.pathname + u.search;
  }

  function isSellableOption(option) {
    const text = [option?.managementLabel, option?.sourceOption, option?.care].filter(Boolean).join(' ');
    return Number.isFinite(Number(option?.monthly)) && !/(?:^|\s)단종\//.test(text);
  }

  function validOptions(product) {
    return Array.isArray(product?.options) ? product.options.filter(isSellableOption) : [];
  }

  function isSelfOption(option) {
    return /자가|셀프|self/i.test([option?.management, option?.managementLabel, option?.care, option?.sourceOption].filter(Boolean).join(' '));
  }

  function isVisitOption(option) {
    return /방문|visit/i.test([option?.management, option?.managementLabel, option?.care, option?.sourceOption].filter(Boolean).join(' '));
  }

  function managementMatch(option, mode) {
    if (!mode) return true;
    return mode === 'self' ? isSelfOption(option) : isVisitOption(option);
  }

  function productText(product) {
    return [
      brandLabel(product.brand), product.brand, product.name, product.model, product.category,
      ...(product.tags || []), ...(product.highlights || []),
      product.shortDescription, product.description, product.promo,
      ...validOptions(product).flatMap(o => [o.managementLabel, o.care, o.sourceOption])
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function applyOverrides(list, overrideData, giftData) {
    const overrides = overrideData?.products || {};
    const giftOverrides = giftData?.products || {};
    list.forEach(product => {
      if (overrides[product.id]) Object.assign(product, overrides[product.id]);
      if (product.sourceKind === 'clover-import' && giftOverrides[product.id]) {
        Object.assign(product, giftOverrides[product.id]);
      }
    });
    return list;
  }

  function trackAi(type, detail = {}) {
    if (typeof window.woongbiTrackConversion !== 'function') return;
    const category = detail.category || lastCriteria?.category || categorySelect.value || 'all';
    let analyticsPath = detail.analyticsPath;
    if (!analyticsPath) {
      analyticsPath = type === 'rental_ai_open'
        ? '/rental/ai/open'
        : '/rental/ai/' + encodeURIComponent(String(category));
    }
    window.woongbiTrackConversion(type, {...detail, analyticsPath});
  }

  async function loadProducts() {
    if (products.length) return products;
    if (loadPromise) return loadPromise;

    status.textContent = '최신 상품 데이터를 확인하는 중입니다.';
    loadPromise = Promise.all([
      fetch('data/products.json', { cache: 'no-store' }).then(r => {
        if (!r.ok) throw new Error('상품 데이터를 불러오지 못했습니다.');
        return r.json();
      }),
      fetch('data/appliance-gift-options.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('data/catalog-overrides.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null)
    ]).then(([data, giftData, overrideData]) => {
      const list = Array.isArray(data?.products) ? data.products : [];
      policyGeneratedAt = giftData?.generatedAt || data?.updatedAt || '';
      products = applyOverrides(list, overrideData, giftData)
        .filter(p => p.availability !== 'inactive')
        .filter(p => !/접수불가|접수중지|단종/.test(String(p.name || '')))
        .filter(p => validOptions(p).length > 0);

      setupSelectors();
      updateStrictControlState();
      status.textContent = products.length
        ? policyMonthText(policyGeneratedAt) + ' · ' + products.length.toLocaleString('ko-KR') + '개 상품 기준'
        : '추천 가능한 상품을 찾지 못했습니다.';
      return products;
    }).catch(error => {
      status.textContent = error.message || '상품 데이터를 불러오지 못했습니다.';
      renderFallback(status.textContent);
      throw error;
    }).finally(() => {
      loadPromise = null;
    });

    return loadPromise;
  }

  function setupSelectors() {
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort((a,b) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return String(a).localeCompare(String(b), 'ko');
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });

    const currentCategory = categorySelect.value;
    categorySelect.innerHTML = categories.map(category =>
      '<option value="' + escapeHtml(category) + '">' + escapeHtml(category) + '</option>'
    ).join('');
    categorySelect.value = categories.includes(currentCategory) ? currentCategory : (categories.includes('정수기') ? '정수기' : categories[0] || '');
    setupBrands();
  }

  function setupBrands() {
    const category = categorySelect.value;
    const brands = [...new Set(products
      .filter(p => !category || p.category === category)
      .map(p => p.brand).filter(Boolean))]
      .sort((a,b) => brandRank(a) - brandRank(b) || brandLabel(a).localeCompare(brandLabel(b), 'ko'));

    const current = brandSelect.value;
    brandSelect.innerHTML = '<option value="">브랜드 상관없음</option>' + brands.map(brand =>
      '<option value="' + escapeHtml(brand) + '">' + escapeHtml(brandLabel(brand)) + '</option>'
    ).join('');
    if (brands.includes(current)) brandSelect.value = current;
    updateStrictControlState();
  }

  function updateStrictControlState() {
    const pairs = [
      [budgetStrict, document.getElementById('ai-budget-strict-wrap'), Number(budgetSelect.value) > 0],
      [brandStrict, document.getElementById('ai-brand-strict-wrap'), Boolean(brandSelect.value)],
      [managementStrict, document.getElementById('ai-management-strict-wrap'), Boolean(managementSelect.value)]
    ];
    pairs.forEach(([input, wrap, enabled]) => {
      if (!input) return;
      input.disabled = !enabled;
      if (!enabled) input.checked = false;
      wrap?.classList.toggle('is-disabled', !enabled);
    });
  }

  function requestedFeatures(query) {
    const q = String(query || '').toLowerCase();
    const defs = [
      { label:'얼음', re:/얼음|아이스/ },
      { label:'직수', re:/직수/ },
      { label:'냉온', re:/냉온|냉수|온수/ },
      { label:'자가관리', re:/자가|셀프/ },
      { label:'방문관리', re:/방문/ },
      { label:'슬림·초소형', re:/슬림|초소형|미니|작은|작게|공간/ },
      { label:'대용량', re:/대용량|업소|사무실|매장/ },
      { label:'무전원', re:/무전원/ },
      { label:'펫', re:/펫|반려/ }
    ];
    return defs.filter(def => def.re.test(q));
  }

  function keywordTokens(query) {
    const stop = new Set(['추천','제품','상품','렌탈','원해요','원함','정도','이하','이내','좋은','좋아','가능','했으면','해주세요','해줘','브랜드']);
    return String(query || '')
      .toLowerCase()
      .replace(/[^0-9a-z가-힣\s]/g, ' ')
      .split(/\s+/)
      .map(x => x.trim())
      .filter(x => x.length >= 2 && !stop.has(x))
      .slice(0, 12);
  }

  function chooseOption(product, criteria) {
    const all = validOptions(product);
    if (!all.length) return null;

    let candidates = all;
    if (criteria.management) {
      const matching = all.filter(o => managementMatch(o, criteria.management));
      if (criteria.strictManagement && !matching.length) return null;
      if (matching.length) candidates = matching;
    }

    if (criteria.strictBudget && criteria.budget > 0) {
      candidates = candidates.filter(o => Number(o.monthly) <= criteria.budget);
      if (!candidates.length) return null;
    }

    const scored = candidates.map(option => {
      const monthly = Number(option.monthly);
      const gift = Number.isFinite(Number(option.gift)) ? Number(option.gift) : 0;
      const term = Number(option.term) || 60;
      let score = gift - monthly * 1.25 - Math.abs(term - 60) * 550;
      if (criteria.budget > 0) {
        if (monthly <= criteria.budget) score += 90000 + (criteria.budget - monthly) * 0.8;
        else score -= (monthly - criteria.budget) * 8;
      }
      if (criteria.management && managementMatch(option, criteria.management)) score += 25000;
      return { option, score };
    }).sort((a,b) => b.score - a.score);

    return scored[0]?.option || candidates[0] || null;
  }

  function scoreProduct(product, criteria) {
    if (criteria.category && product.category !== criteria.category) return null;

    const text = productText(product);
    if (criteria.strictBrand && criteria.brand && String(product.brand) !== criteria.brand) return null;
    if (criteria.mustFeatures.some(key => !FEATURE_DEFS[key]?.re.test(text))) return null;
    if (criteria.strictManagement && criteria.management && !validOptions(product).some(o => managementMatch(o, criteria.management))) return null;

    const option = chooseOption(product, criteria);
    if (!option) return null;

    const monthly = Number(option.monthly);
    const gift = Number.isFinite(Number(option.gift)) ? Number(option.gift) : null;
    let score = 100;
    const reasons = [];

    if (criteria.brand) {
      if (String(product.brand) === criteria.brand) {
        score += 48;
        reasons.push('선호 브랜드 · ' + brandLabel(product.brand));
      } else {
        score -= 16;
      }
    } else {
      const rank = brandRank(product.brand);
      if (rank < 99) score += Math.max(0, 7 - rank);
    }

    if (criteria.budget > 0) {
      if (monthly <= criteria.budget) {
        const room = criteria.budget - monthly;
        score += 42 + Math.min(18, room / 1500);
        reasons.push(room > 0 ? '예산보다 ' + won(room) + ' 낮음' : '예산에 딱 맞음');
      } else {
        const over = monthly - criteria.budget;
        score -= 28 + Math.min(70, over / 500);
      }
    }

    if (criteria.management) {
      if (managementMatch(option, criteria.management)) {
        score += 32;
        reasons.push(criteria.management === 'self' ? '자가관리 조건 일치' : '방문관리 조건 일치');
      } else {
        score -= 35;
      }
    }

    criteria.mustFeatures.forEach(key => {
      const def = FEATURE_DEFS[key];
      if (def?.re.test(text)) {
        score += 30;
        reasons.push(def.label + ' 필수조건 일치');
      }
    });

    requestedFeatures(criteria.query).forEach(feature => {
      if (feature.re.test(text)) {
        score += 24;
        reasons.push(feature.label);
      } else {
        score -= 8;
      }
    });

    keywordTokens(criteria.query).forEach(token => {
      if (text.includes(token)) score += 8;
    });

    if (gift !== null) {
      score += Math.min(35, gift / 10000);
      if (reasons.length < 3) reasons.push('사은품 ' + won(gift));
    }
    score -= Math.min(24, monthly / 6500);

    if (!reasons.length) reasons.push('월요금·혜택 균형');

    return {
      product,
      option,
      monthly,
      gift,
      score,
      reasons: [...new Set(reasons)].slice(0, 3)
    };
  }

  function recommend(criteria) {
    const ranked = products
      .map(product => scoreProduct(product, criteria))
      .filter(Boolean)
      .sort((a,b) => b.score - a.score || brandRank(a.product.brand) - brandRank(b.product.brand));

    if (!ranked.length) return [];
    const withinBudget = criteria.budget > 0 ? ranked.filter(x => x.monthly <= criteria.budget) : ranked;
    return (withinBudget.length >= 3 || criteria.strictBudget ? withinBudget : ranked).slice(0, 3);
  }

  function reasonText(item, index) {
    const lead = index === 0 ? '가장 잘 맞아요' : (index === 1 ? '비교해볼 만해요' : '이런 선택도 있어요');
    return lead + ' · ' + item.reasons.join(' · ');
  }

  function criteriaSummary(criteria) {
    const mustLabels = criteria.mustFeatures.map(key => FEATURE_DEFS[key]?.label).filter(Boolean);
    return [
      criteria.category ? '품목: ' + criteria.category : '',
      criteria.budget > 0 ? '월 예산: ' + won(criteria.budget) + ' 이하' + (criteria.strictBudget ? ' (필수)' : '') : '월 예산: 상관없음',
      criteria.brand ? '선호 브랜드: ' + brandLabel(criteria.brand) + (criteria.strictBrand ? ' (필수)' : '') : '선호 브랜드: 상관없음',
      criteria.management ? '관리방식: ' + (criteria.management === 'self' ? '자가·셀프관리' : '방문관리') + (criteria.strictManagement ? ' (필수)' : '') : '관리방식: 상관없음',
      mustLabels.length ? '필수 기능: ' + mustLabels.join(', ') : '',
      criteria.query ? '추가 조건: ' + criteria.query : ''
    ].filter(Boolean);
  }

  function topSummaryText(item, criteria) {
    const p = item.product;
    const clauses = [];
    if (criteria.budget > 0 && item.monthly <= criteria.budget) clauses.push('예산 안');
    if (criteria.brand && String(p.brand) === criteria.brand) clauses.push(brandLabel(p.brand));
    if (criteria.management && managementMatch(item.option, criteria.management)) clauses.push(criteria.management === 'self' ? '자가관리' : '방문관리');
    criteria.mustFeatures.forEach(key => clauses.push(FEATURE_DEFS[key]?.label || key));
    const head = clauses.length ? clauses.join(' + ') + ' 조건에서' : '선택한 조건에서';
    return head + ' ' + brandLabel(p.brand) + ' ' + p.name + '이 가장 잘 맞습니다. 월 ' + won(item.monthly) + (item.gift == null ? '' : ', 사은품 ' + won(item.gift)) + '.';
  }

  function buildConsultText(criteria, items) {
    const lines = ['[웅비렌탈 AI 추천 상담]', policyMonthText(policyGeneratedAt), ...criteriaSummary(criteria), '', '추천 결과'];
    items.forEach((item, index) => {
      const p = item.product;
      const management = item.option.managementLabel || item.option.care || '';
      const term = Number(item.option.term) ? Number(item.option.term) + '개월' : '';
      lines.push(
        (index + 1) + '. ' + brandLabel(p.brand) + ' ' + p.name,
        '   ' + [management, term, '월 ' + won(item.monthly), item.gift == null ? '사은품 상담 확인' : '사은품 ' + won(item.gift)].filter(Boolean).join(' · ')
      );
    });
    lines.push('', '이 조건으로 상담 부탁드립니다.');
    return lines.join('\n');
  }

  function fallbackCopy(text) {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly','');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch (_) {}
    area.remove();
    return copied;
  }

  function copyConsultText(text) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        status.textContent = '상담 내용이 복사되었습니다. 카카오톡 채팅창에 붙여넣어 주세요.';
      }).catch(() => {
        const copied = fallbackCopy(text);
        status.textContent = copied ? '상담 내용이 복사되었습니다. 카카오톡 채팅창에 붙여넣어 주세요.' : '카카오톡에서 추천 조건을 말씀해 주세요.';
      });
      return;
    }
    const copied = fallbackCopy(text);
    status.textContent = copied ? '상담 내용이 복사되었습니다. 카카오톡 채팅창에 붙여넣어 주세요.' : '카카오톡에서 추천 조건을 말씀해 주세요.';
  }

  function readCompareIds() {
    try {
      return JSON.parse(localStorage.getItem(COMPARE_KEY) || '[]').filter(Boolean).slice(0,3).map(String);
    } catch (_) {
      return [];
    }
  }

  function updateAiCompareButtons(ids = readCompareIds()) {
    document.querySelectorAll('[data-ai-compare]').forEach(button => {
      const active = ids.includes(String(button.dataset.aiCompare || ''));
      button.classList.toggle('active', active);
      button.textContent = active ? '비교담김 ✓' : '비교담기';
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  async function toggleAiCompare(productId) {
    if (window.woongbiRentalCompare?.toggle) {
      const ids = await window.woongbiRentalCompare.toggle(productId);
      const normalized = Array.isArray(ids) ? ids.map(String) : readCompareIds();
      updateAiCompareButtons(normalized);
      status.textContent = normalized.includes(String(productId))
        ? '비교 목록에 담았습니다. 최대 3개까지 비교할 수 있어요.'
        : '비교 목록에서 뺐습니다.';
    } else {
      let ids = readCompareIds();
      const id = String(productId || '');
      if (ids.includes(id)) ids = ids.filter(x => x !== id);
      else if (ids.length < 3) ids.push(id);
      else {
        alert('비교는 최대 3개까지 담을 수 있습니다.');
        return;
      }
      try { localStorage.setItem(COMPARE_KEY, JSON.stringify(ids)); } catch (_) {}
      updateAiCompareButtons(ids);
    }

    trackAi('rental_ai_compare', {
      product_id: String(productId || ''),
      category: lastCriteria?.category || categorySelect.value,
      analyticsPath: '/rental/product/' + encodeURIComponent(String(productId || 'unknown'))
    });
  }

  function renderFallback(message) {
    results.innerHTML =
      '<div class="ai-fallback">' +
        '<strong>' + escapeHtml(message || 'AI 추천 데이터를 잠시 불러오지 못했습니다.') + '</strong>' +
        '<p>추천상품을 직접 보거나 카카오톡·전화로 바로 상담할 수 있어요.</p>' +
        '<div><button type="button" data-ai-fallback-close>추천상품 보기</button>' +
        '<a href="' + KAKAO_CHAT_URL + '" target="_blank" rel="noopener noreferrer">카톡 상담</a>' +
        '<a href="tel:0513437677">전화 상담</a></div>' +
      '</div>';
  }

  function currentCriteria() {
    return {
      category: categorySelect.value,
      budget: Number(budgetSelect.value) || 0,
      brand: brandSelect.value,
      management: managementSelect.value,
      query: preferenceInput.value.trim(),
      strictBudget: budgetStrict?.checked === true,
      strictBrand: brandStrict?.checked === true,
      strictManagement: managementStrict?.checked === true,
      mustFeatures: mustFeatureInputs.filter(input => input.checked).map(input => input.dataset.aiMustFeature).filter(Boolean)
    };
  }

  function buildShareUrl(criteria) {
    const u = new URL('/rental/', location.origin);
    u.searchParams.set('ai','1');
    if (criteria.category) u.searchParams.set('cat',criteria.category);
    if (criteria.budget) u.searchParams.set('budget',String(criteria.budget));
    if (criteria.brand) u.searchParams.set('brand',criteria.brand);
    if (criteria.management) u.searchParams.set('mgmt',criteria.management);
    if (criteria.strictBudget) u.searchParams.set('sb','1');
    if (criteria.strictBrand) u.searchParams.set('sbr','1');
    if (criteria.strictManagement) u.searchParams.set('sm','1');
    if (criteria.mustFeatures?.length) u.searchParams.set('feat',criteria.mustFeatures.join(','));
    if (criteria.query) u.searchParams.set('q',criteria.query.slice(0,120));
    return u.toString();
  }

  function criteriaFromUrl() {
    const p = new URLSearchParams(location.search);
    if (p.get('ai') !== '1') return null;
    return {
      category:p.get('cat') || '정수기',
      budget:Number(p.get('budget')) || 0,
      brand:p.get('brand') || '',
      management:p.get('mgmt') || '',
      query:(p.get('q') || '').slice(0,120),
      strictBudget:p.get('sb') === '1',
      strictBrand:p.get('sbr') === '1',
      strictManagement:p.get('sm') === '1',
      mustFeatures:(p.get('feat') || '').split(',').filter(key => FEATURE_DEFS[key])
    };
  }

  function applyCriteriaToForm(criteria) {
    if (criteria.category && [...categorySelect.options].some(o => o.value === criteria.category)) categorySelect.value = criteria.category;
    setupBrands();
    if (criteria.budget && [...budgetSelect.options].some(o => Number(o.value) === Number(criteria.budget))) budgetSelect.value = String(criteria.budget);
    if (criteria.brand && [...brandSelect.options].some(o => o.value === criteria.brand)) brandSelect.value = criteria.brand;
    if (criteria.management && [...managementSelect.options].some(o => o.value === criteria.management)) managementSelect.value = criteria.management;
    preferenceInput.value = criteria.query || '';
    if (budgetStrict) budgetStrict.checked = Boolean(criteria.strictBudget);
    if (brandStrict) brandStrict.checked = Boolean(criteria.strictBrand);
    if (managementStrict) managementStrict.checked = Boolean(criteria.strictManagement);
    mustFeatureInputs.forEach(input => { input.checked = (criteria.mustFeatures || []).includes(input.dataset.aiMustFeature); });
    updateStrictControlState();
  }

  async function shareRecommendation() {
    if (!lastCriteria || !lastItems.length) return;
    const url = buildShareUrl(lastCriteria);
    const title = '웅비렌탈 AI 추천 결과';
    const text = '웅비렌탈에서 조건에 맞는 렌탈 상품 ' + lastItems.length + '개를 추천받았습니다.';
    try {
      if (navigator.share) {
        await navigator.share({title,text,url});
        status.textContent = '추천 결과를 공유했습니다.';
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        status.textContent = '추천 링크가 복사되었습니다. 카톡에 붙여넣어 주세요.';
      } else {
        fallbackCopy(url);
        status.textContent = '추천 링크가 복사되었습니다.';
      }
      trackAi('rental_ai_share', {
        category:lastCriteria.category,
        result_count:lastItems.length,
        analyticsPath:'/rental/ai/' + encodeURIComponent(String(lastCriteria.category || 'all')) + '/share'
      });
    } catch (_) {
      status.textContent = '공유를 취소했거나 링크를 복사하지 못했습니다.';
    }
  }

  function quoteText(item) {
    const p = item.product;
    const management = item.option.managementLabel || item.option.care || item.option.management || '';
    const term = Number(item.option.term) ? Number(item.option.term) + '개월' : '계약기간 상담 확인';
    return [
      '[웅비렌탈 한눈견적]',
      brandLabel(p.brand) + ' ' + p.name,
      p.model ? '모델: ' + p.model : '',
      '조건: ' + [management,term].filter(Boolean).join(' · '),
      '월 렌탈료: ' + won(item.monthly),
      '고객사은품: ' + (item.gift == null ? '상담 확인' : won(item.gift)),
      '정책 기준: ' + policyMonthText(policyGeneratedAt),
      '※ 설치 후 12개월 이내 미납·정지 또는 해지 시 사은품 금액 반환',
      '상품: ' + new URL(productUrl(p,item.option,false), location.origin).toString()
    ].filter(Boolean).join('\n');
  }

  function ensureQuoteDialog() {
    let quote = document.getElementById('ai-quote-dialog');
    if (quote) return quote;
    quote = document.createElement('dialog');
    quote.id = 'ai-quote-dialog';
    quote.className = 'ai-quote-dialog';
    quote.innerHTML =
      '<div class="ai-quote-shell">' +
        '<button class="ai-quote-close" type="button" aria-label="견적 닫기">×</button>' +
        '<div id="ai-quote-content"></div>' +
      '</div>';
    document.body.appendChild(quote);
    quote.querySelector('.ai-quote-close')?.addEventListener('click',()=>quote.close());
    quote.addEventListener('click',event=>{if(event.target===quote)quote.close();});
    return quote;
  }

  function openQuote(productId) {
    const item = lastItems.find(x => String(x.product.id) === String(productId));
    if (!item) return;
    const p = item.product;
    const management = item.option.managementLabel || item.option.care || item.option.management || '';
    const term = Number(item.option.term) ? Number(item.option.term) + '개월' : '상담 확인';
    const quote = ensureQuoteDialog();
    quote.querySelector('#ai-quote-content').innerHTML =
      '<article class="ai-quote-card">' +
        '<div class="ai-quote-brand"><span>WOONGBI RENTAL</span><b>한눈견적</b></div>' +
        '<small>' + escapeHtml(policyMonthText(policyGeneratedAt)) + '</small>' +
        '<h2>' + escapeHtml(brandLabel(p.brand) + ' ' + p.name) + '</h2>' +
        '<p>' + escapeHtml(p.model || p.category || '') + '</p>' +
        '<div class="ai-quote-grid">' +
          '<div><span>관리·옵션</span><strong>' + escapeHtml(management || '상담 확인') + '</strong></div>' +
          '<div><span>계약기간</span><strong>' + escapeHtml(term) + '</strong></div>' +
          '<div><span>월 렌탈료</span><strong>' + escapeHtml(won(item.monthly)) + '</strong></div>' +
          '<div><span>고객사은품</span><strong>' + (item.gift == null ? '상담 확인' : escapeHtml(won(item.gift))) + '</strong></div>' +
        '</div>' +
        '<div class="ai-quote-return">※ 설치 후 12개월 이내 미납·정지 또는 해지 시 사은품 금액을 반환해 주셔야 합니다.</div>' +
        '<div class="ai-quote-actions">' +
          '<button type="button" data-ai-quote-copy="' + escapeHtml(p.id) + '">견적 내용 복사</button>' +
          '<button type="button" data-ai-quote-share="' + escapeHtml(p.id) + '">견적 공유</button>' +
          '<a href="' + escapeHtml(productUrl(p,item.option,true)) + '" data-ai-apply="' + escapeHtml(p.id) + '">이 조건으로 신청</a>' +
        '</div>' +
        '<p class="ai-quote-foot">실제 접수 전 최신 정책을 다시 확인합니다.</p>' +
      '</article>';
    if (typeof quote.showModal === 'function') quote.showModal(); else quote.setAttribute('open','');
    trackAi('rental_quote_open', {
      category:lastCriteria?.category || p.category || '',
      product_id:p.id,
      analyticsPath:'/rental/product/' + encodeURIComponent(String(p.id))
    });
  }

  async function shareQuote(productId) {
    const item = lastItems.find(x => String(x.product.id) === String(productId));
    if (!item) return;
    const text = quoteText(item);
    const url = new URL(productUrl(item.product,item.option,false), location.origin).toString();
    try {
      if (navigator.share) await navigator.share({title:'웅비렌탈 한눈견적',text,url});
      else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text + '\n' + url);
      else fallbackCopy(text + '\n' + url);
      status.textContent = navigator.share ? '견적을 공유했습니다.' : '견적 내용이 복사되었습니다.';
      trackAi('rental_quote_share', {
        category:lastCriteria?.category || item.product.category || '',
        product_id:item.product.id,
        analyticsPath:'/rental/product/' + encodeURIComponent(String(item.product.id))
      });
    } catch (_) {
      status.textContent = '견적 공유를 취소했거나 복사하지 못했습니다.';
    }
  }

  function recordFeedback(value) {
    if (!lastCriteria || !lastItems.length) return;
    const payload = {
      value,
      category:lastCriteria.category || '',
      products:lastItems.map(x=>x.product.id).slice(0,3),
      at:new Date().toISOString()
    };
    try {
      const rows = JSON.parse(localStorage.getItem('wb_rental_ai_feedback_v1') || '[]');
      rows.push(payload);
      localStorage.setItem('wb_rental_ai_feedback_v1',JSON.stringify(rows.slice(-50)));
    } catch (_) {}
    document.querySelectorAll('[data-ai-feedback]').forEach(btn=>{
      btn.disabled=true;
      if(btn.dataset.aiFeedback===value)btn.classList.add('active');
    });
    status.textContent = value === 'up' ? '도움이 됐다는 의견 고맙습니다.' : '의견을 반영해 추천 방식을 계속 다듬겠습니다.';
    trackAi('rental_ai_feedback', {
      category:lastCriteria.category,
      value,
      analyticsPath:'/rental/ai/' + encodeURIComponent(String(lastCriteria.category || 'all')) + '/feedback/' + value
    });
  }

  function renderResults(items, criteria) {
    lastCriteria = criteria;
    lastItems = items;

    if (!items.length) {
      results.innerHTML = '<div class="ai-empty"><strong>필수조건까지 모두 맞는 상품을 찾지 못했어요.</strong><p>필수조건을 하나 줄이거나 예산을 조금 넓혀서 다시 추천받아 보세요.</p></div>';
      return;
    }

    const top = items[0];
    results.innerHTML =
      '<div class="ai-result-summary"><small>AI 한줄 결론</small><strong>' + escapeHtml(topSummaryText(top, criteria)) + '</strong><span>' + escapeHtml(policyMonthText(policyGeneratedAt)) + '</span></div>' +
      '<div class="ai-result-head"><strong>추천 결과</strong><span>' + escapeHtml(policyMonthText(policyGeneratedAt)) + ' · TOP ' + items.length + '</span></div>' +
      items.map((item,index) => {
        const p = item.product;
        const image = localImageUrl(p.image || p.imageSourceOriginal || '');
        const detailUrl = productUrl(p, item.option, false);
        const applyUrl = productUrl(p, item.option, true);
        const term = Number(item.option.term) ? Number(item.option.term) + '개월' : '계약기간 확인';
        const management = item.option.managementLabel || item.option.care || '';
        return '<article class="ai-result-card">' +
          '<a class="ai-result-image" href="' + escapeHtml(detailUrl) + '" data-ai-product="' + escapeHtml(p.id) + '">' +
            (image ? '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(p.name) + '" loading="lazy">' : '<span>W</span>') +
          '</a>' +
          '<div class="ai-result-body">' +
            '<div class="ai-result-rank"><b>' + (index + 1) + '순위</b><span>' + escapeHtml(reasonText(item,index)) + '</span></div>' +
            '<small>' + escapeHtml(brandLabel(p.brand)) + ' · ' + escapeHtml(p.model || p.category || '') + '</small>' +
            '<h3>' + escapeHtml(p.name) + '</h3>' +
            '<p class="ai-result-condition">' + escapeHtml([management,term].filter(Boolean).join(' · ')) + '</p>' +
            '<div class="ai-result-price"><span>월 <strong>' + escapeHtml(won(item.monthly)) + '</strong></span>' +
              '<span>사은품 <strong>' + (item.gift == null ? '상담 확인' : escapeHtml(won(item.gift))) + '</strong></span></div>' +
            '<div class="ai-result-actions">' +
              '<a class="ai-result-link" href="' + escapeHtml(detailUrl) + '" data-ai-product="' + escapeHtml(p.id) + '">조건 자세히 보기</a>' +
              '<a class="ai-apply-link" href="' + escapeHtml(applyUrl) + '" data-ai-apply="' + escapeHtml(p.id) + '">이 조건으로 신청</a>' +
              '<button class="ai-quote-btn" type="button" data-ai-quote="' + escapeHtml(p.id) + '">한눈견적</button>' +
              '<button class="ai-compare-btn" type="button" data-ai-compare="' + escapeHtml(p.id) + '" aria-pressed="false">비교담기</button>' +
            '</div>' +
          '</div>' +
        '</article>';
      }).join('') +
      '<div class="ai-result-sharebar">' +
        '<button type="button" data-ai-share>추천 결과 링크 공유</button>' +
        '<span>같은 조건과 TOP 3를 링크로 다시 열 수 있어요.</span>' +
      '</div>' +
      '<div class="ai-result-consult">' +
        '<div><strong>이 추천 그대로 상담할까요?</strong><span>추천 조건과 TOP 3가 복사됩니다.</span></div>' +
        '<a class="ai-kakao-consult" data-ai-kakao href="' + KAKAO_CHAT_URL + '" target="_blank" rel="noopener noreferrer">이 조건으로 카톡 상담</a>' +
      '</div>' +
      '<div class="ai-feedback"><span>추천이 도움됐나요?</span><button type="button" data-ai-feedback="up">👍 도움됐어요</button><button type="button" data-ai-feedback="down">👎 조건이 안 맞아요</button></div>' +
      '<p class="ai-result-note">' + escapeHtml(policyMonthText(policyGeneratedAt)) + '의 등록 상품·월요금·사은품 데이터를 비교한 결과입니다. 실제 접수 전 최신 정책을 다시 확인합니다.</p>';

    updateAiCompareButtons();

    trackAi('rental_ai_recommend', {
      category: criteria.category,
      budget: criteria.budget || '',
      brand: criteria.brand || '',
      management: criteria.management || '',
      strict_count: Number(criteria.strictBudget) + Number(criteria.strictBrand) + Number(criteria.strictManagement) + criteria.mustFeatures.length,
      result_count: items.length,
      analyticsPath: '/rental/ai/' + encodeURIComponent(String(criteria.category || 'all'))
    });
  }

  function openDialog() {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open','');
    document.documentElement.classList.add('ai-dialog-open');
  }

  function closeDialog() {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    document.documentElement.classList.remove('ai-dialog-open');
  }

  openButtons.forEach(button => {
    button.addEventListener('click', async () => {
      openDialog();
      trackAi('rental_ai_open', { analyticsPath:'/rental/ai/open' });
      try {
        await loadProducts();
      } catch (_) {}
    });
  });

  closeBtn?.addEventListener('click', closeDialog);
  dialog.addEventListener('click', event => {
    if (event.target === dialog) closeDialog();
  });
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    closeDialog();
  });

  categorySelect.addEventListener('change', () => {
    setupBrands();
    updateStrictControlState();
  });
  budgetSelect.addEventListener('change', updateStrictControlState);
  brandSelect.addEventListener('change', updateStrictControlState);
  managementSelect.addEventListener('change', updateStrictControlState);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      await loadProducts();
      const criteria = currentCriteria();
      status.textContent = '조건을 분석해 가장 잘 맞는 상품을 고르는 중입니다.';
      const items = recommend(criteria);
      renderResults(items, criteria);
      status.textContent = items.length ? '추천이 완료되었습니다.' : '필수조건을 모두 만족하는 상품이 없습니다.';
      results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      status.textContent = error.message || '추천 중 오류가 발생했습니다.';
      renderFallback(status.textContent);
    }
  });

  results.addEventListener('click', event => {
    const fallbackClose = event.target.closest('[data-ai-fallback-close]');
    if (fallbackClose) {
      closeDialog();
      document.getElementById('recommendations')?.scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }

    const shareButton = event.target.closest('[data-ai-share]');
    if (shareButton) {
      event.preventDefault();
      shareRecommendation();
      return;
    }

    const feedbackButton = event.target.closest('[data-ai-feedback]');
    if (feedbackButton) {
      event.preventDefault();
      recordFeedback(feedbackButton.dataset.aiFeedback || 'down');
      return;
    }

    const quoteButton = event.target.closest('[data-ai-quote]');
    if (quoteButton) {
      event.preventDefault();
      openQuote(quoteButton.dataset.aiQuote || '');
      return;
    }

    const compareButton = event.target.closest('[data-ai-compare]');
    if (compareButton) {
      event.preventDefault();
      event.stopPropagation();
      toggleAiCompare(compareButton.dataset.aiCompare || '').catch(() => {
        status.textContent = '비교 목록을 업데이트하지 못했습니다. 잠시 후 다시 시도해 주세요.';
      });
      return;
    }

    const kakaoLink = event.target.closest('[data-ai-kakao]');
    if (kakaoLink) {
      const criteria = lastCriteria || {
        category: categorySelect.value,
        budget: Number(budgetSelect.value) || 0,
        brand: brandSelect.value,
        management: managementSelect.value,
        query: preferenceInput.value.trim(),
        strictBudget:false, strictBrand:false, strictManagement:false, mustFeatures:[]
      };
      copyConsultText(buildConsultText(criteria, lastItems || []));
      trackAi('rental_ai_kakao', {
        category: criteria.category,
        result_count: lastItems.length,
        analyticsPath: '/rental/ai/' + encodeURIComponent(String(criteria.category || 'all')) + '/kakao'
      });
      return;
    }

    const applyLink = event.target.closest('[data-ai-apply]');
    if (applyLink) {
      const id = applyLink.dataset.aiApply || '';
      trackAi('rental_ai_apply', {
        product_id:id,
        category:lastCriteria?.category || categorySelect.value,
        analyticsPath:'/rental/product/' + encodeURIComponent(id || 'unknown')
      });
      return;
    }

    const link = event.target.closest('[data-ai-product]');
    if (!link) return;
    const id = link.dataset.aiProduct || '';
    trackAi('rental_ai_product_click', {
      product_id:id,
      category:lastCriteria?.category || categorySelect.value,
      analyticsPath:'/rental/product/' + encodeURIComponent(id || 'unknown')
    });
  });

  document.addEventListener('click', event => {
    const copyButton = event.target.closest('[data-ai-quote-copy]');
    if (copyButton) {
      const item = lastItems.find(x => String(x.product.id) === String(copyButton.dataset.aiQuoteCopy || ''));
      if (!item) return;
      const text = quoteText(item);
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(()=>{status.textContent='견적 내용이 복사되었습니다.';}).catch(()=>fallbackCopy(text));
      else fallbackCopy(text);
      trackAi('rental_quote_share',{category:lastCriteria?.category || item.product.category || '',product_id:item.product.id,analyticsPath:'/rental/product/'+encodeURIComponent(String(item.product.id))});
      return;
    }
    const shareButton = event.target.closest('[data-ai-quote-share]');
    if (shareButton) {
      shareQuote(shareButton.dataset.aiQuoteShare || '');
    }
  });

  window.woongbiRentalAiStats = () => {
    let rows = [];
    try { rows = JSON.parse(localStorage.getItem('wb_conversion_events_v1') || '[]'); } catch (_) {}
    const today = new Date().toISOString().slice(0,10);
    const aiRows = rows.filter(row => /^(rental_ai_|rental_quote_)/.test(String(row?.type || '')));
    const todays = aiRows.filter(row => String(row?.at || '').slice(0,10) === today);
    const countBy = key => todays.reduce((acc,row) => {
      const value = String(row?.detail?.[key] || 'unknown');
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
    return {
      scope:'this-browser',
      date:today,
      opens:todays.filter(x => x.type === 'rental_ai_open').length,
      recommendations:todays.filter(x => x.type === 'rental_ai_recommend').length,
      productClicks:todays.filter(x => x.type === 'rental_ai_product_click').length,
      quotes:todays.filter(x => x.type === 'rental_quote_open').length,
      shares:todays.filter(x => x.type === 'rental_ai_share').length,
      compares:todays.filter(x => x.type === 'rental_ai_compare').length,
      kakao:todays.filter(x => x.type === 'rental_ai_kakao').length,
      applies:todays.filter(x => x.type === 'rental_ai_apply').length,
      feedbackUp:todays.filter(x => x.type === 'rental_ai_feedback' && x.detail?.value === 'up').length,
      feedbackDown:todays.filter(x => x.type === 'rental_ai_feedback' && x.detail?.value === 'down').length,
      categories:countBy('category'),
      products:countBy('product_id')
    };
  };

  function renderLocalStatsPanel() {
    if (new URLSearchParams(location.search).get('ai_stats') !== '1') return;
    let panel = document.getElementById('ai-local-stats');
    if (!panel) {
      panel = document.createElement('aside');
      panel.id = 'ai-local-stats';
      panel.className = 'ai-local-stats';
      document.body.appendChild(panel);
    }
    const stats = window.woongbiRentalAiStats();
    const top = obj => Object.entries(obj || {}).filter(([key]) => key !== 'unknown').sort((a,b) => b[1]-a[1]).slice(0,3);
    panel.innerHTML =
      '<div><strong>AI 추천 테스트 통계</strong><small>이 브라우저 · ' + escapeHtml(stats.date) + '</small></div>' +
      '<p>열기 <b>' + stats.opens + '</b> → 추천 <b>' + stats.recommendations + '</b> → 상세 <b>' + stats.productClicks + '</b> / 견적 <b>' + stats.quotes + '</b> → 카톡 <b>' + stats.kakao + '</b> / 신청 <b>' + stats.applies + '</b></p>' +
      '<p class="ai-local-stats-sub">추천전환 ' + (stats.opens ? Math.round(stats.recommendations / stats.opens * 100) : 0) + '% · 상담/신청 ' + (stats.recommendations ? Math.round((stats.kakao + stats.applies) / stats.recommendations * 100) : 0) + '% · 공유 ' + stats.shares + ' · 👍 ' + stats.feedbackUp + ' / 👎 ' + stats.feedbackDown + '</p>' +
      '<p class="ai-local-stats-sub">품목 ' + escapeHtml(top(stats.categories).map(([k,v]) => k + ' ' + v).join(' · ') || '기록 없음') + '</p>' +
      '<button type="button" aria-label="통계창 닫기">×</button>';
    panel.querySelector('button')?.addEventListener('click', () => panel.remove(), {once:true});
  }

  async function restoreSharedRecommendation() {
    const criteria = criteriaFromUrl();
    if (!criteria) return;
    openDialog();
    try {
      await loadProducts();
      applyCriteriaToForm(criteria);
      const normalized = currentCriteria();
      const items = recommend(normalized);
      renderResults(items, normalized);
      status.textContent = items.length ? '공유된 추천 조건을 다시 열었습니다.' : '공유된 조건과 정확히 맞는 상품이 없습니다.';
      trackAi('rental_ai_share_open',{category:normalized.category,result_count:items.length,analyticsPath:'/rental/ai/'+encodeURIComponent(String(normalized.category || 'all'))+'/shared'});
    } catch (error) {
      renderFallback(error.message || '공유된 추천 결과를 불러오지 못했습니다.');
    }
  }

  renderLocalStatsPanel();
  window.addEventListener('woongbi:conversion', () => setTimeout(renderLocalStatsPanel, 0));
  restoreSharedRecommendation();
})();