(() => {
  'use strict';

  const panel = document.querySelector('[data-product]');
  if (!panel) return;

  const productId = panel.dataset.product;
  const defaultOptionKey = panel.dataset.defaultOption || '';
  const managementBox = panel.querySelector('[data-selector="management"]');
  const termBox = panel.querySelector('[data-selector="term"]');

  const monthly = document.getElementById('monthly-fee');
  const card = document.getElementById('card-fee');
  const gift = document.getElementById('gift-fee');
  const care = document.getElementById('care-cycle');
  const modalCard = document.getElementById('modal-card-fee');
  const stickyMonthly = document.getElementById('sticky-monthly');
  const stickyGift = document.getElementById('sticky-gift');
  const stickySelection = document.getElementById('sticky-selection');
  const cardWrap = card ? card.closest('.quote-card') : null;

  const won = n => Number(n).toLocaleString('ko-KR') + '원';
  let product = null;
  let state = { management: '', term: '' };

  function currentOptions() {
    return product.options.filter(o => o.management === state.management);
  }

  function renderManagementButtons() {
    const unique = [];
    product.options.forEach(o => {
      if (!unique.some(x => x.value === o.management)) {
        unique.push({ value:o.management, label:o.managementLabel });
      }
    });
    managementBox.innerHTML = unique.map(x =>
      '<button type="button" data-value="'+x.value+'">'+x.label+'</button>'
    ).join('');
    managementBox.classList.toggle('single', unique.length === 1);

    managementBox.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        state.management = btn.dataset.value;
        const options = currentOptions();
        if (!options.some(o => String(o.term) === String(state.term))) {
          state.term = String(options[0].term);
        }
        render();
      });
    });
  }

  function renderTermButtons() {
    const terms = [...new Set(currentOptions().map(o => String(o.term)))];
    termBox.innerHTML = terms.map(term =>
      '<button type="button" data-value="'+term+'">'+term+'개월</button>'
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
    renderTermButtons();
    const variant = product.options.find(o =>
      o.management === state.management && String(o.term) === String(state.term)
    );
    if (!variant) return;

    if (monthly) monthly.textContent = won(variant.monthly);
    const hasCard = variant.card !== null && variant.card !== undefined && Number.isFinite(Number(variant.card));
    if (cardWrap) cardWrap.hidden = !hasCard;
    if (card && hasCard) card.textContent = won(variant.card);
    if (gift) gift.textContent = won(variant.gift);
    if (care) care.textContent = variant.care;
    if (modalCard && hasCard) modalCard.textContent = '월 ' + won(variant.card);
    if (stickyMonthly) stickyMonthly.textContent = won(variant.monthly);
    if (stickyGift) stickyGift.textContent = won(variant.gift);
    if (stickySelection) stickySelection.textContent = variant.managementLabel + ' · ' + variant.term + '개월';

    managementBox.querySelectorAll('button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === state.management);
    });
    termBox.querySelectorAll('button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === String(state.term));
    });
  }

  function initializeProduct(data) {
    product = data.products.find(p => p.id === productId);
    if (!product || !product.options.length) throw new Error('product not found');

    const preferred = product.options.find(o => o.key === defaultOptionKey) || product.options[0];
    state = { management: preferred.management, term: String(preferred.term) };

    renderManagementButtons();
    render();

    document.querySelectorAll('[data-preset-management]').forEach(link => {
      link.addEventListener('click', () => {
        const target = link.dataset.presetManagement;
        if (!product.options.some(o => o.management === target)) return;
        state.management = target;
        const options = currentOptions();
        if (!options.some(o => String(o.term) === String(state.term))) {
          state.term = String(options[0].term);
        }
        render();
      });
    });
  }

  const modal = document.getElementById('card-modal');
  const openBtn = document.getElementById('card-info-btn');
  const closeModal = () => {
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  };
  const openModal = () => {
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  };

  openBtn?.addEventListener('click', openModal);
  modal?.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', closeModal));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  fetch('data/products.json', {cache:'no-store'})
    .then(r => {
      if (!r.ok) throw new Error('product data fetch failed');
      return r.json();
    })
    .then(initializeProduct)
    .catch(() => {
      const notice = panel.querySelector('.notice-box p');
      if (notice) notice.textContent = '상품 정보를 불러오지 못했습니다. 최신 조건은 상담으로 확인해 주세요.';
    });
})();