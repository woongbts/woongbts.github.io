(() => {
  'use strict';

  const id = new URLSearchParams(location.search).get('id');
  const won = n => Number(n).toLocaleString('ko-KR') + '원';
  const brandLabel = brand => ({
    'COWAY':'코웨이',
    'CUCKOO':'쿠쿠',
    'LG퓨리케어':'LG 퓨리케어',
    'SK매직':'SK매직',
    '청호나이스':'청호나이스',
    '현대큐밍':'현대큐밍',
    '루헨스':'루헨스',
    '유버스':'유버스'
  }[brand] || brand || '');
  const $ = sel => document.querySelector(sel);

  function optionLabel(value) {
    let x = String(value || '').trim();
    if (!x) return '';
    x = x.replace(/^단종\//, '');
    x = x.replace(/^기본 조건$/, '기본 옵션');
    x = x.replace(/^방문형(?=$|[·/)]|\s)/, '방문관리');
    x = x.replace(/^셀프형(?=$|[·/)]|\s)/, '셀프관리');
    x = x.replace(/^킹\(K$/, '킹').replace(/^퀸\(Q$/, '퀸').replace(/^슈퍼싱글\(SS$/, '슈퍼싱글');
    x = x.replace(/^토탈케어\((라지킹|킹|퀸|슈퍼싱글|싱글)$/, '토탈케어 · $1');
    x = x.replace(/6개월\s*반값할인/g, '6개월 반값').replace(/10개월\s*반값할인/g, '10개월 반값');
    x = x.replace(/\/+/g, ' · ').replace(/\s*·\s*/g, ' · ').replace(/\s+/g, ' ').trim();
    if (x === '슬러지통x') return '슬러지통 없음';
    if (x === '슬러지통o') return '슬러지통 있음';
    return x;
  }

  function optionHeading(category) {
    if (category === '정수기' || category === '공기청정기' || category === '비데·연수기') return '관리방식 / 제품 옵션';
    if (category === '매트리스·프레임') return '사이즈 / 케어 옵션';
    if (category === '주방가전') return '설치 / 제품 옵션';
    return '제품 옵션';
  }

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
        unique.push({value:o.management, label:optionLabel(o.managementLabel || o.management)});
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
    $('#sticky-selection').textContent = optionLabel(v.managementLabel || v.management) + ' · ' + v.term + '개월';
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
    $('#generic-brand').textContent = brandLabel(product.brand) || 'WOONGBI RENTAL';
    $('#generic-title').textContent = product.name;
    $('#generic-model').textContent = [product.model, product.color].filter(Boolean).join(' · ');
    $('#generic-description').textContent = product.shortDescription || '';
    $('#generic-model-row').textContent = product.model || '-';
    $('#generic-promo').textContent = product.promo || '최신 정책 상담 확인';
    $('#generic-color').textContent = product.color || '상담 확인';
    $('#generic-tags').innerHTML = (product.tags || []).map(t => '<span>' + t + '</span>').join('');
    $('#generic-highlights').innerHTML = (product.highlights || []).map(t => '<span>' + t + '</span>').join('');

    $('#summary-brand').textContent = brandLabel(product.brand) || '-';
    $('#summary-category').textContent = product.category || '-';
    $('#generic-option-label').textContent = optionHeading(product.category);
    $('#summary-option-label').textContent = optionHeading(product.category);
    $('#summary-management').textContent = [...new Set((product.options || []).map(o => optionLabel(o.managementLabel || o.management)).filter(Boolean))].join(' / ') || '-';
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