(() => {
  'use strict';

  const originalFetch = window.fetch.bind(window);
  const params = new URLSearchParams(location.search);
  const deepLinkedTab = params.get('tab');
  const requestedTab = params.get('wbtab') || (deepLinkedTab === 'internet' ? 'internet' : 'mobile');
  const lazyTabs = new Set(['mvno', 'prepaid', 'internet']);
  const activeDataTab = lazyTabs.has(requestedTab) ? requestedTab : 'mobile';

  const lazyData = [
    {
      tab: 'mvno',
      test: path => path.endsWith('/data/mvno-postpaid.json'),
      empty: { meta: {}, providers: [], plans: [] },
    },
    {
      tab: 'prepaid',
      test: path => path.endsWith('/data/prepaid.json'),
      empty: { meta: {}, providers: [], plans: [] },
    },
    {
      tab: 'internet',
      test: path => path.endsWith('/data/internet.json'),
      empty: { meta: {}, providers: [], internet_products: [], tv_products: [], settop_products: [], bundle_rules: [], multi_tv_package_totals: [] },
    },
  ];

  window.fetch = function(input, init) {
    let url;
    try {
      url = new URL(typeof input === 'string' ? input : input.url, location.href);
    } catch {
      return originalFetch(input, init);
    }
    if (url.origin !== location.origin) return originalFetch(input, init);
    const entry = lazyData.find(item => item.test(url.pathname));
    if (!entry || entry.tab === activeDataTab) return originalFetch(input, init);
    return Promise.resolve(new Response(JSON.stringify(entry.empty), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    }));
  };

  function navigationUrl(tab) {
    const url = new URL(location.href);
    const quoteParams = ['tab','ic','ip','itv','itvc','iwb','imb','iq','c','j','d','p','m','mo','w','qid'];
    quoteParams.forEach(key => url.searchParams.delete(key));
    url.searchParams.set('wbtab', tab);
    return url.toString();
  }

  document.addEventListener('click', event => {
    const control = event.target.closest('.rate-tab,[data-jump-tab]');
    if (!control) return;
    const tab = control.dataset.tab || control.dataset.jumpTab;
    if (!lazyTabs.has(tab) || tab === activeDataTab) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    location.assign(navigationUrl(tab));
  }, true);

  document.addEventListener('DOMContentLoaded', () => {
    if (activeDataTab === 'mobile') return;
    if (activeDataTab === 'internet' && deepLinkedTab === 'internet' && params.get('ic') && params.get('ip')) return;
    const tabButton = document.querySelector(`.rate-tab[data-tab="${activeDataTab}"]`);
    if (tabButton) tabButton.click();
  });
})();
