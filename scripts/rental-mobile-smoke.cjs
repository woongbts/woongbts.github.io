const { chromium, devices } = require('playwright');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const browser = await chromium.launch({headless:true});
  const context = await browser.newContext({...devices['iPhone 14']});
  const page = await context.newPage();
  let fullCatalogRequests = 0;
  page.on('request', req => {
    if (/\/rental\/data\/products\.json(?:\?|$)/.test(req.url())) fullCatalogRequests += 1;
  });
  await page.addInitScript(() => {
    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async text => sessionStorage.setItem('wb_test_clipboard', String(text)) }
      });
    } catch (_) {}
  });

  await page.goto('http://127.0.0.1:4173/rental/', {waitUntil:'domcontentloaded'});
  await page.waitForSelector('.recommend-card', {timeout:15000});

  assert(fullCatalogRequests === 0, '첫 화면에서 전체 products.json을 미리 불러오고 있습니다.');
  const policyText = await page.locator('[data-policy-month]').first().textContent();
  assert(/\d{4}년 \d{1,2}월 기준/.test(policyText || ''), '정책 기준월 자동 표시가 동작하지 않습니다.');
  const mattressTile = await page.locator('[data-category-link="매트리스·프레임"]').count();
  assert(mattressTile === 1, '매트리스·프레임 카테고리가 없습니다.');

  const duplicateIds = await page.locator('#recommendations').count();
  assert(duplicateIds === 1, '추천상품 섹션 ID가 중복되었습니다.');

  const homeOverflow = await page.evaluate(() => {
    window.scrollTo(9999, 0);
    const x = window.scrollX;
    window.scrollTo(0, 0);
    return {x, body:document.body.scrollWidth, viewport:document.documentElement.clientWidth};
  });
  assert(homeOverflow.x === 0, '홈 화면이 페이지 전체 단위로 가로 스크롤됩니다.');

  await page.locator('[data-recommend-sort="monthly"]').click();
  assert(await page.locator('[data-recommend-sort="monthly"]').getAttribute('aria-pressed') === 'true', '월요금 정렬 버튼이 동작하지 않습니다.');
  await page.locator('[data-recommend-sort="gift"]').click();
  assert(await page.locator('[data-recommend-sort="gift"]').getAttribute('aria-pressed') === 'true', '사은품 정렬 버튼이 동작하지 않습니다.');
  await page.locator('[data-recommend-sort="recommend"]').click();

  await page.locator('#catalog-toggle').click();
  await page.waitForSelector('.catalog-card');
  assert(fullCatalogRequests >= 1, '전체 상품 열기 후 products.json이 로드되지 않았습니다.');

  await page.locator('[data-category-link="매트리스·프레임"]').click();
  await page.waitForFunction(() => document.querySelector('#category-filter')?.value === '매트리스·프레임');
  await page.waitForTimeout(80);
  const cowayMattress = await page.locator('.catalog-card').filter({hasText:'BEREX'}).count();
  assert(cowayMattress >= 1, '코웨이 BEREX 매트리스가 매트리스 카테고리에 표시되지 않습니다.');

  await page.locator('.catalog-card [data-compare-product]').first().click();
  assert(await page.locator('#compare-bar').count() === 1, '상품 비교담기 바가 표시되지 않습니다.');
  await page.locator('#open-compare').click();
  assert(await page.locator('#compare-modal.open').count() === 1, '상품 비교 모달이 열리지 않습니다.');
  await page.locator('[data-close-compare]').first().click();
  const firstActionHeight = await page.locator('.catalog-card .product-actions .btn').first().evaluate(el => el.getBoundingClientRect().height);
  assert(firstActionHeight >= 44, '모바일 상품 버튼 높이가 44px 미만입니다.');

  await page.goto('http://127.0.0.1:4173/rental/product.html?id=clv-10316', {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => {
    const el = document.querySelector('#monthly-fee');
    return el && el.textContent && el.textContent !== '-';
  }, null, {timeout:15000});

  const recentStored = await page.evaluate(() => JSON.parse(localStorage.getItem('wb_rental_recent_v1') || '[]').some(x => x.id === 'clv-10316'));
  assert(recentStored, '최근 본 상품 저장이 동작하지 않습니다.');
  const canonical = await page.locator('#product-canonical').getAttribute('href');
  assert(canonical && canonical.includes('id=clv-10316'), '상품 canonical URL이 상품별로 갱신되지 않았습니다.');
  const jsonLd = await page.locator('#product-jsonld').textContent();
  assert(jsonLd && jsonLd.includes('"Product"'), '상품 구조화 데이터가 생성되지 않았습니다.');

  const analyticsReady = await page.evaluate(() => typeof window.woongbiTrackConversion === 'function');
  assert(analyticsReady, '렌탈 전환 추적기가 로드되지 않았습니다.');
  const initialRentalEvents = await page.evaluate(() => JSON.parse(localStorage.getItem('wb_conversion_events_v1') || '[]').filter(x => x.type === 'rental_product_view').length);
  assert(initialRentalEvents >= 1, '렌탈 상품 상세 조회 이벤트가 기록되지 않았습니다.');

  const selectors = await page.locator('.selector-step-block').count();
  assert(selectors === 2, '상세페이지의 2단계 선택 UI가 보이지 않습니다.');

  const buttonHeights = await page.locator('.selector-step-block button').evaluateAll(els => els.map(el => el.getBoundingClientRect().height));
  assert(buttonHeights.length > 0 && Math.min(...buttonHeights) >= 44, '상세 조건 버튼의 모바일 터치 영역이 작습니다.');

  await page.locator('#rental-kakao-consult').evaluate(el => el.addEventListener('click', e => e.preventDefault()));
  await page.locator('#rental-kakao-consult').click();
  await page.waitForTimeout(80);
  const copied = await page.evaluate(() => sessionStorage.getItem('wb_test_clipboard') || '');
  assert(copied.includes('[웅비렌탈 상담]') && copied.includes('월 렌탈료:') && copied.includes('고객사은품:'), '카카오톡 상담용 선택조건 복사가 동작하지 않습니다.');
  const kakaoEvent = await page.evaluate(() => JSON.parse(localStorage.getItem('wb_conversion_events_v1') || '[]').some(x => x.type === 'rental_kakao_click'));
  assert(kakaoEvent, '렌탈 카카오톡 상담 전환 이벤트가 기록되지 않았습니다.');

  const detailOverflow = await page.evaluate(() => {
    window.scrollTo(9999, 0);
    const x = window.scrollX;
    window.scrollTo(0, 0);
    return {
      x,
      sticky: document.querySelector('.sticky-quote-inner')?.scrollWidth || 0,
      stickyClient: document.querySelector('.sticky-quote-inner')?.clientWidth || 0
    };
  });
  assert(detailOverflow.x === 0, '상세페이지가 페이지 전체 단위로 가로 스크롤됩니다.');
  assert(detailOverflow.sticky <= detailOverflow.stickyClient + 2, '모바일 하단 견적바가 넘칩니다.');

  console.log('Rental mobile smoke test passed.');
  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
