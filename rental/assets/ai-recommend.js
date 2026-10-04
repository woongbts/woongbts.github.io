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

  let products = [];
  let loadPromise = null;

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

  function localImageUrl(src) {
    const value = String(src || '').trim();
    if (!value) return '';
    return value.startsWith('assets/product-images/') ? '/rental/' + value : value;
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
      products = applyOverrides(list, overrideData, giftData)
        .filter(p => p.availability !== 'inactive')
        .filter(p => !/접수불가|접수중지|단종/.test(String(p.name || '')))
        .filter(p => validOptions(p).length > 0);

      setupSelectors();
      status.textContent = products.length
        ? '현재 등록된 ' + products.length.toLocaleString('ko-KR') + '개 상품을 기준으로 추천합니다.'
        : '추천 가능한 상품을 찾지 못했습니다.';
      return products;
    }).catch(error => {
      status.textContent = error.message || '상품 데이터를 불러오지 못했습니다.';
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

  function managementMatch(option, mode) {
    if (!mode) return true;
    return mode === 'self' ? isSelfOption(option) : isVisitOption(option);
  }

  function chooseOption(product, budget, management) {
    const all = validOptions(product);
    if (!all.length) return null;
    let candidates = management ? all.filter(o => managementMatch(o, management)) : all;
    if (!candidates.length) candidates = all;

    const scored = candidates.map(option => {
      const monthly = Number(option.monthly);
      const gift = Number.isFinite(Number(option.gift)) ? Number(option.gift) : 0;
      const term = Number(option.term) || 60;
      let score = gift - monthly * 1.25 - Math.abs(term - 60) * 550;
      if (budget > 0) {
        if (monthly <= budget) score += 90000 + (budget - monthly) * 0.8;
        else score -= (monthly - budget) * 8;
      }
      if (management && managementMatch(option, management)) score += 25000;
      return { option, score };
    }).sort((a,b) => b.score - a.score);

    return scored[0]?.option || candidates[0];
  }

  function scoreProduct(product, criteria) {
    if (criteria.category && product.category !== criteria.category) return null;

    const text = productText(product);
    const option = chooseOption(product, criteria.budget, criteria.management);
    if (!option) return null;

    const monthly = Number(option.monthly);
    const gift = Number.isFinite(Number(option.gift)) ? Number(option.gift) : null;
    let score = 100;
    const reasons = [];

    if (criteria.brand) {
      if (String(product.brand) === criteria.brand) {
        score += 48;
        reasons.push('선호 브랜드');
      } else {
        score -= 16;
      }
    } else {
      const rank = brandRank(product.brand);
      if (rank < 99) score += Math.max(0, 7 - rank);
    }

    if (criteria.budget > 0) {
      if (monthly <= criteria.budget) {
        score += 42 + Math.min(18, (criteria.budget - monthly) / 1500);
        reasons.push('예산 안');
      } else {
        const over = monthly - criteria.budget;
        score -= 28 + Math.min(70, over / 500);
      }
    }

    if (criteria.management) {
      const matched = validOptions(product).some(o => managementMatch(o, criteria.management));
      if (matched) {
        score += 32;
        reasons.push(criteria.management === 'self' ? '자가관리 가능' : '방문관리 가능');
      } else {
        score -= 35;
      }
    }

    const features = requestedFeatures(criteria.query);
    features.forEach(feature => {
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

    if (gift !== null) score += Math.min(35, gift / 10000);
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
    return (withinBudget.length >= 3 ? withinBudget : ranked).slice(0, 3);
  }

  function reasonText(item, index) {
    const lead = index === 0 ? '가장 잘 맞아요' : (index === 1 ? '비교해볼 만해요' : '이런 선택도 있어요');
    return lead + ' · ' + item.reasons.join(' · ');
  }

  function renderResults(items, criteria) {
    if (!items.length) {
      results.innerHTML = '<div class="ai-empty"><strong>조건에 맞는 상품을 찾지 못했어요.</strong><p>예산이나 선호 조건을 조금 넓혀서 다시 추천받아 보세요.</p></div>';
      return;
    }

    results.innerHTML = '<div class="ai-result-head"><strong>추천 결과</strong><span>현재 상품 데이터 기준 TOP ' + items.length + '</span></div>' +
      items.map((item,index) => {
        const p = item.product;
        const image = localImageUrl(p.image || p.imageSourceOriginal || '');
        const page = p.page || ('product.html?id=' + encodeURIComponent(p.id));
        const term = Number(item.option.term) ? Number(item.option.term) + '개월' : '계약기간 확인';
        const management = item.option.managementLabel || item.option.care || '';
        return '<article class="ai-result-card">' +
          '<a class="ai-result-image" href="' + escapeHtml(page) + '" data-ai-product="' + escapeHtml(p.id) + '">' +
            (image ? '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(p.name) + '" loading="lazy">' : '<span>W</span>') +
          '</a>' +
          '<div class="ai-result-body">' +
            '<div class="ai-result-rank"><b>' + (index + 1) + '순위</b><span>' + escapeHtml(reasonText(item,index)) + '</span></div>' +
            '<small>' + escapeHtml(brandLabel(p.brand)) + ' · ' + escapeHtml(p.model || p.category || '') + '</small>' +
            '<h3>' + escapeHtml(p.name) + '</h3>' +
            '<p class="ai-result-condition">' + escapeHtml([management,term].filter(Boolean).join(' · ')) + '</p>' +
            '<div class="ai-result-price"><span>월 <strong>' + escapeHtml(won(item.monthly)) + '</strong></span>' +
              '<span>사은품 <strong>' + (item.gift == null ? '상담 확인' : escapeHtml(won(item.gift))) + '</strong></span></div>' +
            '<a class="ai-result-link" href="' + escapeHtml(page) + '" data-ai-product="' + escapeHtml(p.id) + '">조건 자세히 보기 →</a>' +
          '</div>' +
        '</article>';
      }).join('') +
      '<p class="ai-result-note">AI 추천은 현재 등록된 상품·월요금·사은품 데이터를 조건별로 비교한 결과입니다. 실제 접수 전 최신 정책을 다시 확인합니다.</p>';

    if (typeof window.woongbiTrackConversion === 'function') {
      window.woongbiTrackConversion('rental_ai_recommend', {
        category: criteria.category,
        budget: criteria.budget || '',
        brand: criteria.brand || '',
        management: criteria.management || '',
        result_count: items.length,
        analyticsPath: '/rental/'
      });
    }
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
      if (typeof window.woongbiTrackConversion === 'function') {
        window.woongbiTrackConversion('rental_ai_open', { analyticsPath: '/rental/' });
      }
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

  categorySelect.addEventListener('change', setupBrands);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      await loadProducts();
      const criteria = {
        category: categorySelect.value,
        budget: Number(budgetSelect.value) || 0,
        brand: brandSelect.value,
        management: managementSelect.value,
        query: preferenceInput.value.trim()
      };
      status.textContent = '조건을 분석해 가장 잘 맞는 상품을 고르는 중입니다.';
      const items = recommend(criteria);
      renderResults(items, criteria);
      status.textContent = '추천이 완료되었습니다.';
      results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      status.textContent = error.message || '추천 중 오류가 발생했습니다.';
    }
  });

  results.addEventListener('click', event => {
    const link = event.target.closest('[data-ai-product]');
    if (!link || typeof window.woongbiTrackConversion !== 'function') return;
    window.woongbiTrackConversion('rental_ai_product_click', {
      product_id: link.dataset.aiProduct || '',
      analyticsPath: '/rental/product/' + encodeURIComponent(link.dataset.aiProduct || 'unknown')
    });
  });
})();