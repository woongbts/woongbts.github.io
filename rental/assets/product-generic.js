(() => {
  'use strict';

  const id = new URLSearchParams(location.search).get('id');
  const won = n => Number(n).toLocaleString('ko-KR') + '원';
  const $ = sel => document.querySelector(sel);

  const managementBox = $('#generic-management');
  const termBox = $('#generic-term');
  let product = null;
  let state = { management: '', term: '' };

  function optionSet() {
    return (product.options || []).filter(o => o.management === state.management);
  }

  function currentVariant() {
    return (product.options || []).find(o =>
      o.management === state.management && String(o.term) === String(state.term)
    );
  }

  function renderManagement() {
    const unique = [];
    (product.options || []).forEach(o => {
      if (!unique.some(x => x.value === o.management)) {
        unique.push({value:o.management, label:o.managementLabel || o.management});
      }
    });

    managementBox.innerHTML = unique.map(x =>
      '<button type="button" data-value="' + x.value + '">' + x.label + '</button>'
    ).join('');
    managementBox.classList.toggle('single', unique.length === 1);

    managementBox.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        state.management = btn.dataset.value;
        const options = optionSet();
        if (!options.some(o => String(o.term) === String(state.term))) {
          state.term = options.length ? String(options[0].term) : '';
        }
        render();
      });
    });
  }

  function renderTerms() {
    const terms = [...new Set(optionSet().map(o => String(o.term)))];
    termBox.innerHTML = terms.map(term =>
      '<button type="button" data-value="' + term + '">' + term + '개월</button>'
    ).join('');
    termBox.classList.toggle('single', terms.length === 1);

    termBox.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        state.term = btn.dataset.value;
        render();
      });
    });
  }

  function render() {
    renderTerms();
    const v = currentVariant();
    if (!v) return;

    managementBox.querySelectorAll('button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === state.management);
    });
    termBox.querySelectorAll('button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === String(state.term));
    });

    $('#monthly-fee').textContent = v.monthly == null ? '상담 확인' : won(v.monthly);
    $('#gift-fee').textContent = v.gift == null ? '상담 확인' : won(v.gift);
    $('#care-cycle').textContent = v.care || '상담 확인';
    $('#sticky-selection').textContent = (v.managementLabel || '') + ' · ' + v.term + '개월';
    $('#sticky-monthly').textContent = v.monthly == null ? '상담 확인' : won(v.monthly);
    $('#sticky-gift').textContent = v.gift == null ? '상담 확인' : won(v.gift);

    const cardRow = $('#generic-card-row');
    if (v.card == null) {
      cardRow.hidden = true;
    } else {
      cardRow.hidden = false;
      $('#card-fee').textContent = won(v.card);
    }
  }

  function initialize(data) {
    product = (data.products || []).find(p => p.id === id);
    if (!product) throw new Error('product not found');

    document.title = product.name + ' | 웅비렌탈';
    $('#breadcrumb-model').textContent = product.model || product.name;
    $('#generic-brand').textContent = product.brand || 'WOONGBI RENTAL';
    $('#generic-title').textContent = product.name;
    $('#generic-model').textContent = [product.model, product.color].filter(Boolean).join(' · ');
    $('#generic-model-row').textContent = product.model || '-';
    $('#generic-promo').textContent = product.promo || '최신 정책 상담 확인';
    $('#generic-color').textContent = product.color || '상담 확인';
    $('#generic-tags').innerHTML = (product.tags || []).map(t => '<span>' + t + '</span>').join('');
    $('#generic-highlights').innerHTML = (product.highlights || []).map(t => '<span>' + t + '</span>').join('');

    $('#summary-brand').textContent = product.brand || '-';
    $('#summary-category').textContent = product.category || '-';
    $('#summary-management').textContent = [...new Set((product.options || []).map(o => o.managementLabel).filter(Boolean))].join(' / ') || '-';
    $('#summary-terms').textContent = [...new Set((product.options || []).map(o => o.term).filter(Boolean))].sort((a,b)=>a-b).map(x => x + '개월').join(' / ') || '-';

    const img = $('#generic-image');
    const art = $('#generic-art');
    if (product.image) {
      img.src = product.image;
      img.alt = product.name;
      img.hidden = false;
      art.hidden = true;
    }

    if (product.sourceUrl) {
      $('#generic-source-note').textContent = '상품 기본정보는 기존 웅비렌탈 판매자료와 2026년 10월 정책을 기준으로 정리했습니다.';
    }

    const detailImages = (product.detailImages || []).filter(Boolean).slice(0, 24);
    const detailSection = $('#generic-source-detail');
    const detailBox = $('#generic-detail-images');
    if (detailSection && detailBox && detailImages.length) {
      detailBox.innerHTML = detailImages.map((src, index) =>
        '<img src="' + src + '" alt="' + product.name + ' 상세 이미지 ' + (index + 1) + '" loading="lazy" referrerpolicy="no-referrer">'
      ).join('');
      detailSection.hidden = false;
    }

    const first = (product.options || [])[0];
    if (!first) throw new Error('no options');
    state.management = first.management;
    state.term = String(first.term);

    renderManagement();
    render();
  }

  fetch('data/products.json', {cache:'no-store'})
    .then(r => {
      if (!r.ok) throw new Error('data fetch failed');
      return r.json();
    })
    .then(initialize)
    .catch(() => {
      $('#generic-title').textContent = '상품 정보를 불러오지 못했습니다.';
      $('#generic-model').textContent = '최신 조건은 상담으로 확인해 주세요.';
      managementBox.innerHTML = '';
      termBox.innerHTML = '';
    });
})();