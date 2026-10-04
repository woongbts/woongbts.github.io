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
  let lastCriteria = null;
  let lastItems = [];

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
    return (withinBudget.length >= 3 ? withinBudget : ranked).slice(0, 3);
  }

  function reasonText(item, index) {
    const lead = index === 0 ? '가장 잘 맞아요' : (index === 1 ? '비교해볼 만해요' : '이런 선택도 있어요');
    return lead + ' · ' + item.reasons.join(' · ');
  }

  function criteriaSummary(criteria) {
    return [
      criteria.category ? '품목: ' + criteria.category : '',
      criteria.budget > 0 ? '월 예산: ' + won(criteria.budget) + ' 이하' : '월 예산: 상관없음',
      criteria.brand ? '선호 브랜드: ' + brandLabel(criteria.brand) : '선호 브랜드: 상관없음',
      criteria.management ? '관리방식: ' + (criteria.management === 'self' ? '자가·셀프관리' : '방문관리') : '관리방식: 상관없음',
      criteria.query ? '추가 조건: ' + criteria.query : ''
    ].filter(Boolean);
  }

  function buildConsultText(criteria, items) {
    const lines = ['[웅비렌탈 AI 추천 상담]', ...criteriaSummary(criteria), '', '추천 결과'];
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
      updateAiCompareButtons(Array.isArray(ids) ? ids.map(String) : readCompareIds());
      status.textContent = readCompareIds().includes(String(productId))
        ? '비교 목록에 담았습니다. 최대 3개까지 비교할 수 있어요.'
        : '비교 목록에서 뺐습니다.';
      return;
    }

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

  function renderResults(items, criteria) {
    lastCriteria = criteria;
    lastItems = items;

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
            '<div class="ai-result-actions">' +
              '<a class="ai-result-link" href="' + escapeHtml(page) + '" data-ai-product="' + escapeHtml(p.id) + '">조건 자세히 보기 →</a>' +
              '<button class="ai-compare-btn" type="button" data-ai-compare="' + escapeHtml(p.id) + '" aria-pressed="false">비교담기</button>' +
            '</div>' +
          '</div>' +
        '</article>';
      }).join('') +
      '<div class="ai-result-consult">' +
        '<div><strong>이 추천 그대로 상담할까요?</strong><span>추천 조건과 TOP 3가 복사됩니다.</span></div>' +
        '<a class="ai-kakao-consult" data-ai-kakao href="' + KAKAO_CHAT_URL + '" target="_blank" rel="noopener noreferrer">이 조건으로 카톡 상담</a>' +
      '</div>' +
      '<p class="ai-result-note">AI 추천은 현재 등록된 상품·월요금·사은품 데이터를 조건별로 비교한 결과입니다. 실제 접수 전 최신 정책을 다시 확인합니다.</p>';

    updateAiCompareButtons();

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
      const text = buildConsultText(lastCriteria || {
        category: categorySelect.value,
        budget: Number(budgetSelect.value) || 0,
        brand: brandSelect.value,
        management: managementSelect.value,
        query: preferenceInput.value.trim()
      }, lastItems || []);
      copyConsultText(text);
      if (typeof window.woongbiTrackConversion === 'function') {
        window.woongbiTrackConversion('rental_ai_kakao', {
          category: lastCriteria?.category || categorySelect.value,
          result_count: lastItems.length,
          analyticsPath: '/rental/'
        });
      }
      return;
    }

    const link = event.target.closest('[data-ai-product]');
    if (!link || typeof window.woongbiTrackConversion !== 'function') return;
    window.woongbiTrackConversion('rental_ai_product_click', {
      product_id: link.dataset.aiProduct || '',
      analyticsPath: '/rental/product/' + encodeURIComponent(link.dataset.aiProduct || 'unknown')
    });
  });
})();