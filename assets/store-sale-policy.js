/* Store-confirmed effective dates; never combine legacy prices with NEW-model subsidies. */
(() => {
  'use strict';
  const day = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const available = (d, date = day()) => !(/아이폰\s*17\s+(256|512)GB\s*\(NEW\)/i.test(d?.name || '') && date < '2026-10-01');
  window.WoongbiSalePolicy = {available};
  const note = document.getElementById('store-price-period');
  if (note && day() < '2026-10-01') {
    note.hidden = false;
    note.textContent = '아이폰17 9월 판매 안내 · 9월 30일까지 256GB 1,287,000원 / 512GB 1,584,000원. 기존 모델의 가입유형별 지원금과 월 납부액은 매장에서 확인해 주세요. NEW 모델은 10월 1일부터 256GB 1,452,000원 / 512GB 1,760,000원 기준으로 계산할 수 있습니다.';
  }
})();
