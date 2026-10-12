(() => {
  'use strict';
  const section = document.getElementById('rental-real-stories');
  const grid = document.getElementById('rental-real-stories-grid');
  if (!section || !grid) return;
  // Empty by default. Never display fabricated testimonials or private details.
  fetch('data/verified-stories.json', {cache:'no-store'})
    .then(response => response.ok ? response.json() : Promise.reject(new Error('not found')))
    .then(data => {
      const items = (Array.isArray(data?.items) ? data.items : []).filter(item =>
        item?.permissionConfirmed === true &&
        typeof item.title === 'string' && item.title.trim() &&
        typeof item.summary === 'string' && item.summary.trim()
      ).slice(0, 6);
      if (!items.length) return;
      items.forEach(item => {
        const card = document.createElement('article');
        card.className = 'rental-real-story';
        const meta = document.createElement('span');
        meta.className = 'story-tag';
        meta.textContent = [item.region, item.product].filter(v => typeof v === 'string' && v.trim()).join(' · ') || '실제 설치 사례';
        card.append(meta);
        const title = document.createElement('h3');
        title.textContent = item.title;
        card.append(title);
        if (typeof item.photo === 'string' && /^assets\/verified-stories\/[a-z0-9._-]+\.(?:webp|jpe?g|png)$/i.test(item.photo)) {
          const image = document.createElement('img');
          image.src = item.photo;
          image.alt = typeof item.photoAlt === 'string' ? item.photoAlt : item.title;
          image.loading = 'lazy';
          card.append(image);
        }
        const body = document.createElement('p');
        body.textContent = item.summary;
        card.append(body);
        grid.append(card);
      });
      section.hidden = false;
    }).catch(() => {
      // Hide the section when verified case data is missing/unavailable.
      section.hidden = true;
    });
})();
