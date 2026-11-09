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
    const channel = $('mvno-enrollment-channel');
    if (kind === 'postpaid' && channel) channel.textContent = visible
      ? '프리티 요금제 · 온라인 개통신청이 가능합니다. 신청 후 접수 확인과 유심 발송을 안내합니다.'
      : providerId && providerId !== 'all'
        ? '선택하신 통신사 요금제 · 웅비통신 매장 방문 개통이 가능합니다. 방문 전 가입 가능 여부를 문의해 주세요.'
        : '프리티는 온라인 개통신청 가능 · 다른 알뜰폰 통신사는 매장 방문 개통으로 안내합니다.';
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

  // The November 2026 partner table verifies these selected customer fees.
  // Internal activation/management commissions must never appear on public pages.
  const FEATURED = Object.freeze([
    {id:'FREETKT-202611-7G', fee:19800, tag:'월요금 가볍게',note:'7GB 이후 최대 1Mbps · 기본제공 통화'},
    {id:'FREETKT-202611-15G', fee:25300, tag:'가성비 데이터',note:'15GB 이후 최대 1Mbps · 기본제공 통화'},
    {id:'FREETSKT-2031', fee:29700, tag:'15GB · 3Mbps',note:'통화 100분 · 문자 100건 · 데이터 15GB 이후 최대 3Mbps'},
    {id:'FREETSKT-202611-11G', fee:37290, tag:'데이터 넉넉하게',note:'11GB+매일 2GB 이후 최대 3Mbps'},
    {id:'FREETLG-1425', fee:43890, tag:'대용량 데이터',note:'11GB+매일 2GB 이후 최대 3Mbps'}
  ]);
  function choosePlans(plans) {
    const available = new Map((plans||[]).map(plan => [plan.id,plan]));
    return FEATURED.map(feature => {
      const plan=available.get(feature.id);
      if(!plan || Number(plan.special_monthly_fee??plan.monthly_fee)!==feature.fee
        || plan.source_reviewed_at!=='2026-11-04') return null;
      return {...plan, customerTag:feature.tag, featuredNote:feature.note};
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
        const card = make('details','freet-plan-card');
        const summary = make('summary','freet-plan-summary');
        const heading = make('span','freet-plan-summary-heading');
        heading.append(
          make('strong','freet-plan-name',plan.name || '프리티 후불 요금제'),
          make('small','freet-plan-tag',plan.customerTag)
        );
        summary.append(
          heading,
          make('strong','freet-plan-price',money(plan.special_monthly_fee ?? plan.monthly_fee)),
          make('span','freet-plan-chevron','⌄')
        );
        summary.querySelector('.freet-plan-chevron').setAttribute('aria-hidden','true');
        const expanded = make('div','freet-plan-expanded');
        expanded.append(make('span','freet-plan-provider','프리티 ' + networkName(plan.network) + '망'));
        const specs = make('dl','freet-plan-specs');
        for (const [label, value] of [['데이터',plan.data],['통화',plan.voice],['문자',plan.sms]]) {
          const row = make('div','freet-plan-spec-row');
          row.append(make('dt','',label),make('dd','',value || '확인 필요'));
          specs.append(row);
        }
        expanded.append(specs);
        expanded.append(make('p','freet-plan-explainer',plan.featuredNote));
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
        const apply = make('a','freet-apply-link','온라인 개통신청 →');
        apply.href = href('postpaid',plan.id);
        more.append(select,apply);
        expanded.append(more);
        card.append(summary,expanded);
        card.addEventListener('toggle',() => {
          if (!card.open) return;
          list.querySelectorAll('.freet-plan-card[open]').forEach(other => {
            if (other !== card) other.open = false;
          });
        });
        list.append(card);
      }
    } catch (err) {
      list.replaceChildren(make('p','freet-load-error',
        '11월 추천요금제 가격을 아직 확인하지 못했어요. 전체 요금제에서 프리티를 선택하거나 개통 신청 후 최신 요금을 확인해 주세요.'));
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
    const grid = $('mvno-all-grid');
    const feature = $('freet-postpaid-feature');
    const compact = $('freet-postpaid-compact');
    const disclosure = $('freet-postpaid-disclosure');
    if (disclosure && location.hash === '#freet-postpaid-feature') disclosure.open = true;
    const syncMode = () => {
      const all = grid && !grid.hidden;
      if (feature) feature.hidden = !!all;
      if (compact) compact.hidden = !all;
    };
    if (grid) new MutationObserver(syncMode).observe(grid,{attributes:true,attributeFilter:['hidden']});
    syncMode();
    // Switching views must not wait for the calculator's catalog requests.
    document.querySelectorAll('[data-mvno-mode]').forEach(button => {
      button.addEventListener('click', () => {
        const all = button.dataset.mvnoMode === 'all';
        if (grid) grid.hidden = !all;
        const recommendations = $('mvno-recommend');
        if (recommendations) recommendations.hidden = all;
        document.querySelectorAll('[data-mvno-mode]').forEach(item => {
          const active = item === button;
          item.classList.toggle('active',active);
          item.setAttribute('aria-selected',String(active));
        });
        syncMode();
      });
    });
    document.querySelector('[data-mvno-mode="all"]')?.addEventListener('click', () => {
      requestAnimationFrame(() => {
        syncMode();
        if (grid && !grid.hidden) {
          grid.setAttribute('tabindex','-1');
          grid.focus({preventScroll:true});
          grid.scrollIntoView({behavior:'auto',block:'start'});
        }
      });
    });
    $('freet-show-recommendations')?.addEventListener('click', () => {
      if (disclosure) disclosure.open = true;
      document.querySelector('[data-mvno-mode="recommend"]')?.click();
      requestAnimationFrame(() => {
        syncMode();
        feature?.setAttribute('tabindex','-1');
        feature?.focus({preventScroll:true});
        feature?.scrollIntoView({behavior:'auto',block:'start'});
      });
    });
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
