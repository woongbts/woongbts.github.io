(() => {
  'use strict';

  const grid = document.getElementById('product-grid');
  if (!grid) return;

  const searchInput = document.getElementById('catalog-search');
  const brandFilters = document.getElementById('brand-filters');
  const categoryFilter = document.getElementById('category-filter');
  const count = document.getElementById('catalog-count');

  const state = { query: '', brand: '', category: '' };
  let products = [];

  const won = n => Number(n).toLocaleString('ko-KR') + '원';

  function purifierArt() {
    return '<div class="purifier-art large" aria-hidden="true"><div class="purifier-head"><span>250</span></div><div class="purifier-body"></div><div class="purifier-base"></div></div>';
  }

  function visual(product) {
    if (product.image) {
      return '<img class="catalog-product-image" src="' + product.image + '" alt="' + product.name + '" loading="lazy" referrerpolicy="no-referrer">';
    }
    return purifierArt();
  }

  function renderProduct(product) {
    const validOptions = Array.isArray(product.options) ? product.options.filter(o => Number.isFinite(Number(o.monthly))) : [];
    const monthlyValues = validOptions.map(o => Number(o.monthly));
    const giftValues = validOptions.map(o => Number(o.gift)).filter(Number.isFinite);
    const minMonthly = monthlyValues.length ? Math.min(...monthlyValues) : null;
    const maxGift = giftValues.length ? Math.max(...giftValues) : null;
    const managements = [...new Set(validOptions.map(o => o.managementLabel).filter(Boolean))].join(' · ');
    const tags = (product.tags || []).slice(0, 5).map(t => '<span>' + t + '</span>').join('');
    const highlights = (product.highlights || []).slice(0, 4).map(t => '<li>' + t + '</li>').join('');

    return `
      <article class="catalog-card">
        <a class="catalog-visual" href="${product.page || '#'}" aria-label="${product.name} 상세보기">
          <span class="brand-label">${product.brand || ''}</span>
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

  function normalizeText(value) {
    return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function matches(product) {
    if (state.brand && product.brand !== state.brand) return false;
    if (state.category && product.category !== state.category) return false;
    if (!state.query) return true;

    const haystack = normalizeText([
      product.brand,
      product.name,
      product.model,
      product.category,
      ...(product.tags || [])
    ].join(' '));
    return haystack.includes(normalizeText(state.query));
  }

  function render() {
    const visible = products.filter(matches);
    grid.innerHTML = visible.length
      ? visible.map(renderProduct).join('')
      : '<p class="catalog-error">조건에 맞는 상품이 없습니다. 검색어나 필터를 바꿔보세요.</p>';
    grid.removeAttribute('aria-busy');
    if (count) count.textContent = '현재 ' + visible.length.toLocaleString('ko-KR') + '개 상품';
  }

  function setupFilters() {
    const brands = [...new Set(products.map(p => p.brand).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'ko'));
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'ko'));

    if (brandFilters) {
      brandFilters.innerHTML = [
        '<button type="button" class="active" data-brand="">전체</button>',
        ...brands.map(brand => '<button type="button" data-brand="' + brand + '">' + brand + '</button>')
      ].join('');

      brandFilters.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          state.brand = btn.dataset.brand || '';
          brandFilters.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === btn));
          render();
        });
      });
    }

    if (categoryFilter) {
      categoryFilter.innerHTML = '<option value="">전체 카테고리</option>' +
        categories.map(category => '<option value="' + category + '">' + category + '</option>').join('');
      categoryFilter.addEventListener('change', () => {
        state.category = categoryFilter.value;
        render();
      });
    }

    searchInput?.addEventListener('input', () => {
      state.query = searchInput.value;
      render();
    });
  }

  fetch('data/products.json', {cache:'no-store'})
    .then(r => {
      if (!r.ok) throw new Error('catalog fetch failed');
      return r.json();
    })
    .then(data => {
      products = Array.isArray(data.products) ? data.products : [];
      setupFilters();
      render();
    })
    .catch(() => {
      grid.innerHTML = '<p class="catalog-error">상품 정보를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.</p>';
      grid.removeAttribute('aria-busy');
      if (count) count.textContent = '';
    });
})();