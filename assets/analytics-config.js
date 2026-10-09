// Owner analytics exclusion is stored per browser on the public site (not in the CRM origin).
(() => {
  const key = 'wb_owner_analytics_excluded_v1';
  const queryKey = 'wb_admin_visits';
  const isExcluded = () => { try { return localStorage.getItem(key) === '1'; } catch { return false; } };
  window.woongbiAnalyticsOwnerExcluded = isExcluded;
  if (location.hostname !== 'woongbts.github.io') return;
  const url = new URL(location.href);
  const action = url.searchParams.get(queryKey);
  if (action !== 'exclude' && action !== 'include') return;
  let saved = false;
  try {
    if (action === 'exclude') localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
    saved = true;
  } catch {}
  url.searchParams.delete(queryKey);
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  function announce() {
    const el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.textContent = !saved ? '브라우저 설정을 저장하지 못했습니다. 일반 모드에서 다시 시도해 주세요.'
      : action === 'exclude' ? '관리자 방문 제외 완료 · 이 브라우저의 다음 방문부터 통계에 반영하지 않습니다.'
      : '방문 집계 다시 시작 · 이 브라우저의 다음 방문부터 기록합니다.';
    Object.assign(el.style, {position:'fixed',top:'14px',left:'50%',transform:'translateX(-50%)',
      zIndex:'2147483647',maxWidth:'min(92vw,480px)',padding:'13px 18px',borderRadius:'12px',
      color:'#fff',background:'#103f53',boxShadow:'0 5px 22px #0004',fontSize:'15px',
      fontWeight:'700',lineHeight:'1.45',textAlign:'center'});
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 6500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', announce, {once:true});
  else announce();
})();
window.WOONGBI_ANALYTICS={version:"20260929-2",naverCommonKey:"",naverHost:"woongbts.github.io",siteAnalyticsEndpoint:"https://woongbi-consent.woongbts.workers.dev/api/site-analytics",siteConversionEndpoint:"https://woongbi-consent.woongbts.workers.dev/api/site-conversion"};
// Common page-view tracking only. Individual conversion types remain unconfigured.
(() => {
  if (location.hostname !== 'woongbts.github.io' || window.__WB_NAVER_WCS_COMMON__ || window.woongbiAnalyticsOwnerExcluded?.()) return;
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
