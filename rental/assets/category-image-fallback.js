/* Keep category thumbnails usable when a supplier image host blocks hotlinks. */
(() => {
  const images = document.querySelectorAll('.category-product-image img');
  images.forEach(img => {
    const handleFailure = () => {
      const source = img.getAttribute('src') || '';
      if (!img.dataset.imageRetry && /^https:\/\/storage\.bilrigo\.com\/data\/thumbnails\//i.test(source)) {
        img.dataset.imageRetry = '1';
        img.src = 'https://images.weserv.nl/?url='
          + encodeURIComponent(source.replace(/^https?:\/\//, ''))
          + '&w=900&output=webp';
        return;
      }
      img.hidden = true;
      if (!img.parentElement.querySelector('.category-photo-message')) {
        const fallback = document.createElement('span');
        fallback.className = 'category-photo-message';
        fallback.textContent = '사진 확인 중';
        img.parentElement.appendChild(fallback);
      }
    };
    img.addEventListener('error', handleFailure);
    if (img.complete && img.naturalWidth === 0) handleFailure();
  });

  // Category cards are pre-rendered from vendor data; keep gift figures in full
  // thousands even before the next static-page regeneration.
  document.querySelectorAll('.category-product-price span').forEach(row => {
    if (!/사은품/.test(row.textContent || '')) return;
    const amount = row.querySelector('strong');
    const match = amount?.textContent.trim().match(/^(최대\s*)?([\d,]+)원$/);
    if (!match) return;
    const number = Number(match[2].replace(/,/g, ''));
    if (!Number.isFinite(number) || number < 0) return;
    amount.textContent = (match[1] || '') +
      (Math.floor(number / 1000) * 1000).toLocaleString('ko-KR') + '원';
  });
})();
