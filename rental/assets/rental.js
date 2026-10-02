(() => {
  'use strict';

  const variants = {
    'visit-36': { monthly: 51900, card: 38900, gift: 205000, care: '방문형 4개월', label: '방문관리 · 36개월' },
    'visit-60': { monthly: 44900, card: 31900, gift: 280000, care: '방문형 4개월', label: '방문관리 · 60개월' },
    'self-36':  { monthly: 48900, card: 35900, gift: 190000, care: '셀프형 12개월', label: '셀프관리 · 36개월' },
    'self-60':  { monthly: 42900, card: 29900, gift: 265000, care: '셀프형 12개월', label: '셀프관리 · 60개월' }
  };

  const panel = document.querySelector('[data-product="cp-aqs100ewh"]');
  if (!panel) return;

  const state = { management: 'self', term: '60' };
  const monthly = document.getElementById('monthly-fee');
  const card = document.getElementById('card-fee');
  const gift = document.getElementById('gift-fee');
  const care = document.getElementById('care-cycle');
  const modalCard = document.getElementById('modal-card-fee');
  const stickyMonthly = document.getElementById('sticky-monthly');
  const stickyGift = document.getElementById('sticky-gift');
  const stickySelection = document.getElementById('sticky-selection');

  const won = n => Number(n).toLocaleString('ko-KR') + '원';

  function render() {
    const key = state.management + '-' + state.term;
    const v = variants[key];
    if (!v) return;
    monthly.textContent = won(v.monthly);
    card.textContent = won(v.card);
    gift.textContent = won(v.gift);
    care.textContent = v.care;
    if (modalCard) modalCard.textContent = '월 ' + won(v.card);
    if (stickyMonthly) stickyMonthly.textContent = won(v.monthly);
    if (stickyGift) stickyGift.textContent = won(v.gift);
    if (stickySelection) stickySelection.textContent = v.label;

    panel.querySelectorAll('[data-selector="management"] button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === state.management);
    });
    panel.querySelectorAll('[data-selector="term"] button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === state.term);
    });
  }

  panel.querySelectorAll('[data-selector] button').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.closest('[data-selector]').dataset.selector;
      state[group] = btn.dataset.value;
      render();
    });
  });

  document.querySelectorAll('[data-preset-management]').forEach(link => {
    link.addEventListener('click', () => {
      state.management = link.dataset.presetManagement;
      render();
    });
  });

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

  render();
})();