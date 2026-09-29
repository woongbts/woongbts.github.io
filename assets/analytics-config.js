window.WOONGBI_ANALYTICS={version:"20260929-2",naverCommonKey:"",naverHost:"woongbts.github.io",siteAnalyticsEndpoint:"https://woongbi-consent.woongbts.workers.dev/api/site-analytics",siteConversionEndpoint:"https://woongbi-consent.woongbts.workers.dev/api/site-conversion"};
// Common page-view tracking only. Individual conversion types remain unconfigured.
(() => {
  if (location.hostname !== 'woongbts.github.io' || window.__WB_NAVER_WCS_COMMON__) return;
  window.__WB_NAVER_WCS_COMMON__ = true;
  const script = document.createElement('script');
  script.src = 'https://wcs.naver.net/wcslog.js';
  script.async = true;
  script.dataset.wbNaverCommon = 'loading';
  const start = () => {
    try {
      if (!window.wcs || typeof window.wcs_do !== 'function') throw Error('unavailable');
      window.wcs_add = window.wcs_add || {};
      window.wcs_add.wa = 's_20e798684471';
      window._nasa = window._nasa || {};
      window.wcs.inflow('woongbts.github.io');
      window.wcs_do();
      script.dataset.wbNaverCommon = 'initialized';
    } catch {
      script.dataset.wbNaverCommon = 'failed';
    }
  };
  if (window.wcs) { start(); return; }
  script.onload = start;
  script.onerror = () => { script.dataset.wbNaverCommon = 'load-failed'; };
  document.head.appendChild(script);
})();
