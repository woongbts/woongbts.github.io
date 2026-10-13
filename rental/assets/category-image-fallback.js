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
})();
