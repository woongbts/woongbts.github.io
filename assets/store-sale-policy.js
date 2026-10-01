/* Compatibility shim: temporary September 2026 sale-transition rules have expired. */
(() => {
  'use strict';
  const available = () => true;
  window.WoongbiSalePolicy = {available};
  const note = document.getElementById('store-price-period');
  if (note) {
    note.hidden = true;
    note.textContent = '';
  }
})();
