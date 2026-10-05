(() => {
  const params = new URLSearchParams(location.search);
  const requested = params.get('tab') || params.get('wbtab');
  const allowed = new Set(['mobile','studyphone','mvno','prepaid','internet']);
  if (!allowed.has(requested)) return;

  function openRequestedTab() {
    const tab = document.querySelector('.rate-tab[data-tab="' + requested + '"]');
    const panel = document.querySelector('.rate-panel[data-panel="' + requested + '"]');
    if (!tab || !panel) return;
    tab.click();
    if (requested !== 'mobile') {
      requestAnimationFrame(() => {
        panel.scrollIntoView({behavior:'auto', block:'start'});
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', openRequestedTab, {once:true});
  } else {
    openRequestedTab();
  }
})();
