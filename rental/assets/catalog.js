(() => {
  'use strict';

  const grid = document.getElementById('product-grid');
  if (!grid) return;

  const searchInput = document.getElementById('catalog-search');
  const brandFilters = document.getElementById('brand-filters');
  const categoryFilter = document.getElementById('category-filter');
  const featureFilters = document.getElementById('feature-filters');
  const count = document.getElementById('catalog-count');
  const moreBtn = document.getElementById('catalog-more');
  const catalogToggle = document.getElementById('catalog-toggle');
  const catalogPanel = document.getElementById('catalog-panel');
  const recommendTabs = document.getElementById('recommend-tabs');
  const recommendGrid = document.getElementById('recommend-grid');
  const applianceMore = document.getElementById('appliance-more');
  const applianceGrid = document.querySelector('.appliance-grid');

  const PAGE_SIZE = window.matchMedia('(max-width:560px)').matches ? 8 : 12;
  const RECOMMEND_CATEGORIES = ['정수기','공기청정기','비데·연수기','안마의자','매트리스·프레임'];
  let recommendCategory = '정수기';
  const state = { query: '', brand: '', category: '', feature: '', limit: PAGE_SIZE };
  let products = [];

  const won = n => Number(n).toLocaleString('ko-KR') + '원';
  const IMAGE_REV = '20261003-7f78334';
  const localImageUrl = src => {
    const value = String(src || '').trim();
    if (!value) return '';
    if (value.startsWith('assets/product-images/')) return '/rental/' + value + '?v=' + IMAGE_REV;
    return value;
  };
  const imageCandidatesFor = product => {
    const raw = [product.image, product.imageSourceOriginal, ...((product.detailImages || []).slice(0, 3))].filter(Boolean);
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
    if (!product.image && !(product.detailImages || []).length) {
      return '<div class="catalog-image-slot">' + placeholder + '</div>';
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
    const validOptions = Array.isArray(product.options) ? product.options.filter(o => Number.isFinite(Number(o.monthly))) : [];
    const monthlyValues = validOptions.map(o => Number(o.monthly));
    const giftValues = validOptions
      .filter(o => o.gift !== null && o.gift !== undefined && o.gift !== '')
      .map(o => Number(o.gift))
      .filter(Number.isFinite);
    const minMonthly = monthlyValues.length ? Math.min(...monthlyValues) : null;
    const maxGift = giftValues.length ? Math.max(...giftValues) : null;
    const managements = [...new Set(validOptions.map(o => optionLabel(o.managementLabel)).filter(Boolean))].slice(0,3).join(' · ');
    const tags = (product.tags || []).slice(0, 5).map(t => '<span>' + t + '</span>').join('');
    const highlights = (product.highlights || []).slice(0, 4).map(t => '<li>' + t + '</li>').join('');

    return `
      <article class="catalog-card">
        <a class="catalog-visual" href="${product.page || '#'}" aria-label="${product.name} 상세보기">
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
            <div class="gift"><small>웅비렌탈 사은품</small><strong>${maxGift == null ? '상담 확인' : '최대 ' + won(maxGift)}</strong></div>
          </div>
          <p class="promo">${product.promo || '최신 프로모션 상담 확인'}</p>
          <p class="catalog-meta">${managements || '상세 조건 확인'}</p>
          <div class="product-actions">
            <a class="btn primary" href="${product.page || '#'}">조건별 금액 보기</a>
            <a class="btn ghost" href="http://pf.kakao.com/_nWwNT/chat" target="_blank" rel="noopener noreferrer">바로 상담</a>
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

  function recommendationMetrics(product) {
    const validOptions = Array.isArray(product.options)
      ? product.options.filter(o => Number.isFinite(Number(o.monthly)))
      : [];
    if (!validOptions.length) return null;
    const gifts = validOptions.map(o => Number(o.gift)).filter(Number.isFinite);
    const monthly = validOptions.map(o => Number(o.monthly)).filter(Number.isFinite);
    if (!gifts.length || !monthly.length) return null;
    return {
      maxGift: Math.max(...gifts),
      minMonthly: Math.min(...monthly)
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
    return m.maxGift - (m.minMonthly * 1.55) - (over * 4.5);
  }

  function recommendationCard(product) {
    const m = recommendationMetrics(product);
    const minMonthly = m?.minMonthly ?? null;
    const maxGift = m?.maxGift ?? null;
    const preference = brandPreference(product);
    const image = imageCandidatesFor(product)[0] || '';
    return `
      <article class="recommend-card">
        <a class="recommend-image" href="${product.page || '#'}">
          ${image ? '<img src="' + image + '" alt="' + product.name + '" loading="lazy">' : '<span class="recommend-fallback">W</span>'}
        </a>
        <div class="recommend-body">
          <div class="recommend-meta">
            <small>${brandLabel(product.brand)} · ${product.model || product.category || ''}</small>
            ${preference.rank < 99 ? '<span class="recommend-preference">' + preference.label + '</span>' : ''}
          </div>
          <h3>${product.name}</h3>
          <div class="recommend-prices">
            <span>월 ${minMonthly == null ? '상담 확인' : won(minMonthly) + '부터'}</span>
            <strong>${maxGift == null ? '사은품 상담 확인' : '사은품 최대 ' + won(maxGift)}</strong>
          </div>
          <a class="recommend-link" href="${product.page || '#'}">조건 보기 →</a>
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

    const selected = [];
    const preferredGroups = BRAND_PREFERENCE.map(pref => ({
      pref,
      items: candidates
        .filter(p => pref.test(String(p.brand || '')))
        .sort((a,b) => recommendationScore(b) - recommendationScore(a))
    }));

    // Show one strong-value option from each preferred brand in the requested order.
    preferredGroups.forEach(group => {
      if (selected.length >= 4) return;
      if (group.items.length) selected.push(group.items[0]);
    });

    // If a preferred brand is missing in this category, fill with the best remaining value picks.
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

    recommendGrid.innerHTML = selected.map(recommendationCard).join('');
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

  function matches(product) {
    if (!matchesBase(product)) return false;
    if (!state.feature) return true;
    const def = featureDefs.find(x => x.key === state.feature);
    return !def || def.test(productText(product));
  }

  function filteredProducts() {
    return products.filter(p => p.availability !== 'inactive').filter(matches);
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
    if (hash === '#products') openCatalog();
    if (hash === '#recommendations') recommendCategory = '정수기';
  }

  function setupFilters() {
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

    searchInput?.addEventListener('input', () => {
      state.query = searchInput.value;
      if (state.feature && !featureDefs.some(def => def.key === state.feature)) state.feature = '';
      resetAndRender();
    });

    const shortcutLinks = [...document.querySelectorAll('[data-category-link]')];
    const categoryCounts = products.reduce((acc, product) => {
      acc[product.category] = (acc[product.category] || 0) + 1;
      return acc;
    }, {});
    shortcutLinks.forEach(link => {
      link.hidden = !categoryCounts[link.dataset.categoryLink];
    });

    const syncShortcutActive = () => {
      shortcutLinks.forEach(link => link.classList.toggle('active', link.dataset.categoryLink === state.category));
    };

    shortcutLinks.forEach(link => {
      link.addEventListener('click', () => {
        openCatalog();
        state.category = link.dataset.categoryLink || '';
        if (categoryFilter) categoryFilter.value = state.category;
        syncShortcutActive();
        resetAndRender();
      });
    });

    syncShortcutActive();

    moreBtn?.addEventListener('click', () => {
      state.limit += PAGE_SIZE;
      render();
    });

    catalogToggle?.addEventListener('click', () => {
      if (catalogPanel?.hidden) openCatalog();
      else closeCatalog();
    });

    applianceMore?.addEventListener('click', () => {
      const expanded = applianceGrid?.classList.toggle('is-expanded');
      applianceMore.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      applianceMore.textContent = expanded ? '품목 접기' : '다른 품목 4개 보기';
    });
  }

  fetch('data/products.json', {cache:'no-store'})
    .then(r => {
      if (!r.ok) throw new Error('catalog fetch failed');
      return r.json();
    })
    .then(data => {
      products = Array.isArray(data.products)
        ? data.products.filter(p => p.availability !== 'inactive' && !/접수불가|접수중지/.test(String(p.name || '')))
        : [];
      handleDirectSectionHash();
      setupFilters();
      renderRecommendations();
      render();
    })
    .catch(() => {
      grid.innerHTML = '<p class="catalog-error">상품 정보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</p>';
      grid.removeAttribute('aria-busy');
      if (count) count.textContent = '';
      if (moreBtn) moreBtn.hidden = true;
    });
})();