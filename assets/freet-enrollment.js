/* Freet partner signup entry points; public plan data is always source-backed. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const freet = value => /^FREET(?:SKT|KT|LG)/i.test(String(value || ''));
  const money = value => Number.isFinite(Number(value)) && Number(value) > 0
    ? Number(value).toLocaleString('ko-KR') + '원' : '요금 확인 필요';
  const href = (kind, planId) => '/freet/apply/?type=' + kind +
    (planId ? '&plan=' + encodeURIComponent(String(planId)) : '');
  const networkName = value => value === 'LGU+' ? 'LG U+' : String(value || '');
  const make = (tag, cls, value) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (value !== undefined) node.textContent = value;
    return node;
  };

  function updateSelected(kind) {
    const prefix = kind === 'postpaid' ? 'mvno' : 'prepaid';
    const provider = $(prefix + '-provider');
    const plan = $(prefix + '-plan');
    const area = $('freet-' + kind + '-selected');
    const link = $('freet-' + kind + '-selected-link');
    if (!area || !link || !provider) return;
    const providerId = plan?.selectedOptions?.[0]?.dataset?.providerId || provider.value;
    const visible = freet(providerId);
    area.hidden = !visible;
    if (visible) link.href = href(kind, plan?.value || '');
  }

  function bindSelected(kind) {
    const prefix = kind === 'postpaid' ? 'mvno' : 'prepaid';
    const provider = $(prefix + '-provider');
    const plan = $(prefix + '-plan');
    if (!provider || !plan) return;
    for (const node of [provider, plan]) node.addEventListener('change', () => {
      updateSelected(kind);
      queueMicrotask(() => updateSelected(kind));
    });
    updateSelected(kind);
    // Existing pricing script hydrates the dropdown asynchronously.
    const observer = new MutationObserver(() => updateSelected(kind));
    observer.observe(provider, {childList: true});
    observer.observe(plan, {childList: true});
  }

  function capacity(plan) {
    const text = String(plan?.data || '');
    const match = text.match(/([\d.]+)\s*(GB|MB)/i);
    if (!match) return -1;
    return Number(match[1]) / (match[2].toUpperCase() === 'MB' ? 1024 : 1);
  }

  function choosePlans(plans) {
    const rules = [
      {provider:'FREETSKT', name:'가볍게', match:gb=>gb>=0 && gb<5},
      {provider:'FREETKT', name:'일상용', match:gb=>gb>=5 && gb<15},
      {provider:'FREETLG', name:'데이터 넉넉히', match:gb=>gb>=15}
    ];
    return rules.map(rule => {
      const options = plans.filter(plan => plan.provider_id === rule.provider &&
        Number(plan.special_monthly_fee ?? plan.monthly_fee) > 0);
      const matched = options.filter(plan => rule.match(capacity(plan)));
      const chosen = (matched.length ? matched : options).sort((a,b) =>
        Number(a.special_monthly_fee ?? a.monthly_fee) -
        Number(b.special_monthly_fee ?? b.monthly_fee) ||
        Number(a.source_order || 0) - Number(b.source_order || 0))[0];
      return chosen ? {...chosen, customerTag:rule.name} : null;
    }).filter(Boolean);
  }

  async function showPostpaid() {
    const list = $('freet-postpaid-list');
    if (!list) return;
    try {
      const api = window.WoongbiMvnoApi;
      if (!api || typeof api.loadCatalog !== 'function') throw Error('catalog API unavailable');
      const data = await api.loadCatalog();
      const plans = Array.isArray(data.plans) ? data.plans : [];
      const picked = choosePlans(plans);
      if (!picked.length) throw Error('No Freet postpaid plans found in verified catalog');
      list.replaceChildren();
      for (const plan of picked) {
        const card = make('article', 'freet-plan-card');
        card.append(make('span','freet-plan-tag',plan.customerTag));
        card.append(make('strong','freet-plan-name',plan.name || '프리티 후불 요금제'));
        card.append(make('span','freet-plan-provider','프리티 ' + networkName(plan.network) + '망'));
        const price = make('strong','freet-plan-price',money(plan.special_monthly_fee ?? plan.monthly_fee));
        card.append(price);
        card.append(make('p','freet-plan-specs',
          ['데이터 '+(plan.data || '확인 필요'),'통화 '+(plan.voice || '확인 필요'),'문자 '+(plan.sms || '확인 필요')].join(' · ')));
        const more = make('div','freet-plan-actions');
        const select = make('button','freet-detail-button','요금제 상세');
        select.type = 'button';
        select.addEventListener('click', () => {
          const provider = $('mvno-provider');
          const picker = $('mvno-plan');
          if (!provider || !picker) return;
          document.querySelector('[data-mvno-mode="all"]')?.click();
          provider.value = plan.provider_id;
          provider.dispatchEvent(new Event('change',{bubbles:true}));
          if ([...picker.options].some(option => option.value === plan.id)) {
            picker.value = plan.id;
            picker.dispatchEvent(new Event('change',{bubbles:true}));
          }
          $('mvno-all-grid')?.scrollIntoView({behavior:'smooth',block:'start'});
        });
        const apply = make('a','freet-apply-link','개통 신청 →');
        apply.href = href('postpaid',plan.id);
        more.append(select,apply);
        card.append(more);
        list.append(card);
      }
    } catch (err) {
      list.replaceChildren(make('p','freet-load-error',
        '추천 요금제 자료를 불러오지 못했어요. 전체 요금제에서 프리티를 선택하거나 개통 신청 후 요금제를 확인해 주세요.'));
      console.warn('Freet highlighted postpaid data unavailable:',err?.message);
    }
  }

  function attachPrepaidButtons() {
    const list = $('prepaid-recommend-list');
    if (!list) return;
    for (const btn of list.querySelectorAll('button[data-prepaid-recommend]')) {
      const card = btn.closest('.prepaid-recommend-card');
      if (!card || card.querySelector('.freet-apply-link')) continue;
      const apply = make('a','freet-apply-link','프리티 선불 개통 신청 →');
      apply.href = href('prepaid',btn.dataset.prepaidRecommend);
      card.append(apply);
    }
  }

  function init() {
    bindSelected('postpaid');
    bindSelected('prepaid');
    showPostpaid();
    attachPrepaidButtons();
    const root = $('prepaid-recommend-list');
    if (root) new MutationObserver(attachPrepaidButtons)
      .observe(root,{childList:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init,{once:true});
  else init();
})();
