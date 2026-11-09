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
          make('strong','freet-plan-price','월 ' + money(plan.special_monthly_fee ?? plan.monthly_fee)),
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


  // Other postpaid MVNOs use the same public catalogue as the full calculator.
  // This is a compact discovery view, not a separate set of published prices.
  const otherState = {
    plans:[], providers:[], usage:'all', provider:'all', network:'all',
    shown:5, ready:false, pending:null, recommendedIds:new Set()
  };
  const otherFee = plan => {
    const fee = Number(plan?.special_monthly_fee ?? plan?.monthly_fee);
    return Number.isFinite(fee) && fee > 0 ? fee : null;
  };
  const otherGb = plan => {
    const label = String(plan?.data || '');
    const gb = label.match(/(\d+(?:\.\d+)?)\s*GB/i);
    if (gb) return Number(gb[1]);
    const mb = label.match(/(\d+(?:\.\d+)?)\s*MB/i);
    return mb ? Number(mb[1]) / 1024 : null;
  };
  function filteredOtherPlans() {
    return otherState.plans.filter(plan => {
      if (otherState.provider !== 'all' && plan.provider_id !== otherState.provider) return false;
      if (otherState.network !== 'all' && plan.network !== otherState.network) return false;
      const fee = otherFee(plan);
      const gb = otherGb(plan);
      if (otherState.usage === 'under10') return fee !== null && fee < 10000;
      if (otherState.usage === 'daily') return gb !== null && gb >= 5 && gb < 15;
      if (otherState.usage === 'heavy') {
        const data = String(plan.data || '');
        return (gb !== null && gb >= 15) || /매일\s*\d+(?:\.\d+)?\s*(GB|MB)/i.test(data);
      }
      return true;
    });
  }
  function diverseOtherPlans(plans) {
    // Rotate carriers first, then their next-lowest prices, rather than showing
    // five offers from one carrier simply because its prices sort first.
    const groups = new Map();
    for (const plan of plans) {
      if (!groups.has(plan.provider_id)) groups.set(plan.provider_id,[]);
      groups.get(plan.provider_id).push(plan);
    }
    const byPrice = (a,b) => (Number(otherState.recommendedIds.has(String(b.id))) - Number(otherState.recommendedIds.has(String(a.id)))) ||
      (otherFee(a) ?? Infinity) - (otherFee(b) ?? Infinity) ||
      String(a.name || '').localeCompare(String(b.name || ''),'ko');
    for (const group of groups.values()) group.sort(byPrice);
    const sorted = [...groups.keys()].sort((a,b) => {
      const af = otherFee(groups.get(a)[0]) ?? Infinity;
      const bf = otherFee(groups.get(b)[0]) ?? Infinity;
      const ar = Number(otherState.recommendedIds.has(String(groups.get(a)[0].id)));
      const br = Number(otherState.recommendedIds.has(String(groups.get(b)[0].id)));
      return br - ar || af - bf || String(a).localeCompare(String(b),'ko');
    });
    const result = [];
    while (sorted.some(id => groups.get(id).length)) {
      for (const id of sorted) {
        if (groups.get(id).length) result.push(groups.get(id).shift());
      }
    }
    return result;
  }
  function renderOtherPlans() {
    const list = $('mvno-other-results');
    const counter = $('mvno-other-count');
    const more = $('mvno-other-more');
    if (!list || !counter || !more || !otherState.ready) return;
    const providerNames = new Map(otherState.providers.map(provider => [provider.id,provider.name]));
    const filtered = diverseOtherPlans(filteredOtherPlans());
    const count = filtered.length;
    const providerCount = new Set(filtered.map(plan => plan.provider_id)).size;
    counter.textContent = count ?
      providerCount.toLocaleString('ko-KR') + '개 통신사 · ' + count.toLocaleString('ko-KR') + '개 요금제 중 ' +
      Math.min(count,otherState.shown).toLocaleString('ko-KR') + '개 표시' :
      '현재 선택 조건에 맞는 요금제가 없습니다. 다른 조건을 선택해 주세요.';
    list.replaceChildren();
    for (const plan of filtered.slice(0,otherState.shown)) {
      const card = make('details','mvno-other-card');
      const heading = make('summary','mvno-other-plan-summary');
      const text = make('span','mvno-other-plan-copy');
      const providerName = providerNames.get(plan.provider_id) || String(plan.provider_id || '등록 통신사');
      text.append(make('small','mvno-other-plan-provider',providerName + (plan.network ? ' · ' + networkName(plan.network) + '망' : '')));
      if (otherState.recommendedIds.has(String(plan.id))) text.append(make('small','mvno-other-plan-recommended','웅비통신 추천'));
      text.append(
        make('strong','mvno-other-plan-name',plan.name || '요금제'),
        make('small','mvno-other-plan-data',plan.data ? '데이터 ' + String(plan.data) : '데이터 제공량 확인 필요')
      );
      const amount = make('strong','mvno-other-plan-price',otherFee(plan) === null ? '요금 확인 필요' : '월 ' + money(otherFee(plan)));
      heading.append(text,amount,make('span','mvno-other-plan-arrow','⌄'));
      heading.querySelector('.mvno-other-plan-arrow').setAttribute('aria-hidden','true');
      const expanded = make('div','mvno-other-plan-expanded');
      const specs = make('dl','mvno-other-plan-specs');
      for (const [label,value] of [['데이터',plan.data],['통화',plan.voice],['문자',plan.sms]]) {
        const row = make('div','mvno-other-plan-spec-row');
        row.append(make('dt','',label),make('dd','',value || '확인 필요'));
        specs.append(row);
      }
      expanded.append(specs);
      if (plan.customer_note) expanded.append(make('p','mvno-other-plan-note',String(plan.customer_note)));
      if (Number(plan.contract_months) > 0) {
        expanded.append(make('p','mvno-other-plan-note',
          String(plan.contract_months) + '개월 약정 조건 · 할인 기간 및 이후 요금은 최종 확인'));
      } else if (otherFee(plan) !== null && Number(plan.regular_monthly_fee) > otherFee(plan)) {
        expanded.append(make('p','mvno-other-plan-note','할인 적용 요금입니다. 할인 기간과 이후 요금을 확인해 주세요.'));
      }
      const action = make('a','mvno-other-plan-consult','매장 상담·개통 문의 →');
      action.href = 'tel:0513437677';
      expanded.append(action);
      card.append(heading,expanded);
      card.addEventListener('toggle',() => {
        if (!card.open) return;
        list.querySelectorAll('.mvno-other-card[open]').forEach(other => {
          if (other !== card) other.open = false;
        });
      });
      list.append(card);
    }
    more.hidden = count <= otherState.shown;
    if (!more.hidden) more.textContent = '다른 요금제 더 보기 (' + (count - otherState.shown).toLocaleString('ko-KR') + '개 남음)';
  }
  async function loadOtherPlans() {
    if (otherState.ready || otherState.pending) return otherState.pending;
    const counter = $('mvno-other-count');
    if (counter) counter.textContent = '통신사와 요금제를 확인하고 있습니다.';
    otherState.pending = (async () => {
      try {
        const api = window.WoongbiMvnoApi;
        if (!api || typeof api.loadCatalog !== 'function') throw Error('catalog API unavailable');
        const data = await api.loadCatalog();
        const providers = Array.isArray(data.providers) ? data.providers : [];
        const map = new Map(providers.map(p => [p.id,p]));
        const plans = Array.isArray(data.plans) ? data.plans : [];
        otherState.providers = providers;
        const curated = data.recommendations && typeof data.recommendations === 'object' ? data.recommendations : {};
        otherState.recommendedIds = new Set(Object.values(curated).flatMap(group => Array.isArray(group) ? group : [])
          .map(item => item?.plan?.id ?? item?.id ?? (typeof item === 'string' ? item : null))
          .filter(Boolean).map(String));
        otherState.plans = plans.filter(plan => {
          if (!plan?.id || !plan.provider_id || freet(plan.provider_id)) return false;
          const provider = map.get(plan.provider_id);
          return !/프리티|프리텔레콤/i.test(String(provider?.name || ''));
        });
        const picker = $('mvno-other-provider');
        if (picker) {
          for (const id of new Set(otherState.plans.map(plan => plan.provider_id))) {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = map.get(id)?.name || id;
            picker.append(option);
          }
        }
        otherState.ready = true;
        renderOtherPlans();
      } catch (err) {
        if (counter) counter.textContent = '요금제 데이터를 현재 불러오지 못했습니다. 아래 상세 검색이나 전화 상담을 이용해 주세요.';
        console.warn('Other MVNO menu unavailable:',err?.message);
      } finally {
        otherState.pending = null;
      }
    })();
    return otherState.pending;
  }
  function initOtherPlans() {
    const disclosure = $('mvno-other-disclosure');
    if (!disclosure) return;
    disclosure.addEventListener('toggle',() => {
      if (disclosure.open) loadOtherPlans();
    });
    if (location.hash === '#mvno-other-feature') disclosure.open = true;
    if (disclosure.open) loadOtherPlans();
    document.querySelectorAll('[data-mvno-other-usage]').forEach(button => {
      button.addEventListener('click',() => {
        otherState.usage = button.dataset.mvnoOtherUsage;
        otherState.shown = 5;
        document.querySelectorAll('[data-mvno-other-usage]').forEach(item => {
          const selected = item === button;
          item.classList.toggle('active',selected);
          item.setAttribute('aria-pressed',String(selected));
        });
        renderOtherPlans();
      });
    });
    $('mvno-other-provider')?.addEventListener('change',event => {
      otherState.provider = event.target.value;
      otherState.shown = 5;
      renderOtherPlans();
    });
    $('mvno-other-network')?.addEventListener('change',event => {
      otherState.network = event.target.value;
      otherState.shown = 5;
      renderOtherPlans();
    });
    $('mvno-other-more')?.addEventListener('click',() => {
      otherState.shown += 5;
      renderOtherPlans();
    });
    $('mvno-other-full')?.addEventListener('click',() => {
      document.querySelector('[data-mvno-mode="all"]')?.click();
      requestAnimationFrame(() => $('mvno-all-grid')?.scrollIntoView({behavior:'auto',block:'start'}));
    });
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
    const otherFeature = $('mvno-other-feature');
    const compact = $('freet-postpaid-compact');
    const disclosure = $('freet-postpaid-disclosure');
    if (disclosure && location.hash === '#freet-postpaid-feature') disclosure.open = true;
    const syncMode = () => {
      const all = grid && !grid.hidden;
      if (feature) feature.hidden = !!all;
      if (otherFeature) otherFeature.hidden = !!all;
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
    initOtherPlans();
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
