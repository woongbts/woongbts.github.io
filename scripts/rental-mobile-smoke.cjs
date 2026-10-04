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
  await page.route('https://woongbi-consent.woongbts.workers.dev/api/rental-application-policy', async route => {
    const origin='http://127.0.0.1:4173';
    if(route.request().method()==='OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':origin,'access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'content-type'}});
    return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':origin},body:JSON.stringify({ok:true,policy:{
      version:'WB-RENTAL-APPLICATION-TEST',purpose:'렌탈 신청 접수 및 계약 진행',
      items:{required:'성명, 연락처, 설치주소',optional:'이메일, 문의사항'},retention:'최대 90일',refusal:'온라인 신청은 필수정보가 필요합니다.',
      payment_notice:'계좌번호·카드번호 전체는 수집하지 않습니다.',
      third_party:{purpose:'렌탈 계약 진행',items:'신청정보',retention:'처리 목적 달성 시까지',refusal:'동의하지 않으면 온라인 신청이 어렵습니다.'}
    }})});
  });
  await page.route('https://woongbi-consent.woongbts.workers.dev/api/rental-application', async route => {
    const origin='http://127.0.0.1:4173';
    if(route.request().method()==='OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':origin,'access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'content-type'}});
    return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':origin},body:JSON.stringify({ok:true,receipt:{id:'00000000-test',submitted_at:new Date().toISOString(),status:'접수완료'}})});
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


  // AI 추천: 필수조건, 정책 기준, 비교담기, 카카오 상담, 신청 링크를 모바일에서 검증합니다.
  await page.locator('[data-ai-recommend-open]').first().click();
  await page.waitForSelector('#ai-recommend-dialog[open]');
  await page.waitForFunction(() => document.querySelector('#ai-category')?.value === '정수기');
  await page.locator('#ai-budget').selectOption('40000');
  await page.locator('#ai-management').selectOption('self');
  await page.locator('#ai-budget-strict').check();
  await page.locator('#ai-management-strict').check();
  await page.locator('[data-ai-must-feature="direct"]').check();
  await page.locator('#ai-recommend-form').evaluate(form => form.requestSubmit());
  await page.waitForSelector('.ai-result-card');
  const aiSummary = await page.locator('.ai-result-summary strong').textContent();
  assert(aiSummary && /월\s[\d,]+원/.test(aiSummary), 'AI 1위 한줄 요약에 월요금 근거가 없습니다.');
  const aiPolicy = await page.locator('.ai-result-head span').textContent();
  assert(/\d{4}년 \d{1,2}월 정책 기준/.test(aiPolicy || ''), 'AI 추천 결과에 정책 기준월이 없습니다.');
  const applyHref = await page.locator('.ai-apply-link').first().getAttribute('href');
  assert(applyHref && /\/rental\/product\/[^/]+\/\?/.test(applyHref) && /mgmt=/.test(applyHref) && /term=/.test(applyHref) && /apply=1/.test(applyHref), 'AI 추천 신청 링크가 선택 조건을 이어주지 못합니다.');
  await page.locator('[data-ai-compare]').first().click();
  assert(await page.locator('[data-ai-compare].active').count() >= 1, 'AI 추천 결과 비교담기가 동작하지 않습니다.');
  await page.locator('[data-ai-kakao]').evaluate(el => el.addEventListener('click', e => e.preventDefault()));
  await page.locator('[data-ai-kakao]').click();
  await page.waitForTimeout(80);
  const aiCopied = await page.evaluate(() => sessionStorage.getItem('wb_test_clipboard') || '');
  assert(aiCopied.includes('[웅비렌탈 AI 추천 상담]') && aiCopied.includes('추천 결과'), 'AI 추천 카카오 상담 복사가 동작하지 않습니다.');
  const aiEvents = await page.evaluate(() => JSON.parse(localStorage.getItem('wb_conversion_events_v1') || '[]').map(x => x.type));
  assert(aiEvents.includes('rental_ai_open') && aiEvents.includes('rental_ai_recommend') && aiEvents.includes('rental_ai_compare') && aiEvents.includes('rental_ai_kakao'), 'AI 전환 이벤트 기록이 누락되었습니다.');
  await page.locator('#ai-recommend-close').click();
  await page.evaluate(() => {
    localStorage.removeItem('wb_rental_compare_v1');
    document.getElementById('compare-bar')?.remove();
  });

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
  await page.locator('.compare-close').click();
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
  assert(canonical && canonical.includes('/rental/product/clv-10316/'), '상품 canonical URL이 깨끗한 상품 경로로 갱신되지 않았습니다.');
  const jsonLd = await page.locator('#product-jsonld').textContent();
  assert(jsonLd && jsonLd.includes('"Product"'), '상품 구조화 데이터가 생성되지 않았습니다.');

  await page.locator('#rental-apply-open').click();
  assert(await page.locator('#rental-apply-dialog[open]').count() === 1, '온라인 렌탈 신청창이 열리지 않습니다.');
  await page.waitForFunction(() => document.querySelector('#rental-processing-policy')?.textContent?.includes('최대 90일'));
  const paymentWarning = await page.locator('.rental-billing p').textContent();
  assert(paymentWarning.includes('계좌번호') && paymentWarning.includes('카드번호'), '결제정보 전체번호 미수집 안내가 없습니다.');
  await page.locator('#rental-apply-name').fill('테스트고객');
  await page.locator('#rental-apply-phone').fill('01012345678');
  await page.locator('#rental-apply-address').fill('부산광역시 테스트 주소');
  await page.locator('input[name="billing_method"][value="bank"]').check();
  await page.locator('#rental-apply-issuer').fill('테스트은행');
  await page.locator('#rental-processing-ack').check();
  await page.locator('#rental-third-party-consent').check();
  const giftDepositNote = await page.locator('#rental-apply-gift-note').textContent();
  assert(giftDepositNote.includes('설치 후 1주일 이내 입금'), '사은품 입금 안내가 없습니다.');
  const giftReturnNote = await page.locator('#rental-apply-gift-return-note').textContent();
  assert(giftReturnNote.includes('1년 이내') && giftReturnNote.includes('반환'), '사은품 반환 안내가 없습니다.');
  await page.locator('#rental-apply-submit').click();
  await page.waitForSelector('#rental-apply-success-dialog[open]');
  assert(await page.locator('#rental-apply-dialog[open]').count() === 0, '신청 성공 후 입력창이 닫히지 않습니다.');
  const successTitle = await page.locator('#rental-apply-success-title').textContent();
  const successMessage = await page.locator('#rental-apply-success-dialog p').textContent();
  assert(successTitle.includes('신청이 접수되었습니다') && successMessage.includes('확인 후 연락드리겠습니다'), '신청 완료 팝업 문구가 올바르지 않습니다.');
  const applySuccess = await page.evaluate(() => JSON.parse(localStorage.getItem('wb_conversion_events_v1') || '[]').some(x => x.type === 'rental_apply_success'));
  assert(applySuccess, '렌탈 신청 성공 전환 이벤트가 기록되지 않았습니다.');
  await page.locator('#rental-apply-success-confirm').click();
  assert(await page.locator('#rental-apply-success-dialog[open]').count() === 0, '신청 완료 팝업이 확인 버튼으로 닫히지 않습니다.');


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
  const stickyPriceBox = await page.locator('.sticky-price').boundingBox();
  const stickyApplyBox = await page.locator('#rental-apply-sticky').boundingBox();
  const stickyConsultBox = await page.locator('#rental-kakao-sticky').boundingBox();
  const viewport = page.viewportSize();
  assert(stickyPriceBox && stickyPriceBox.x >= 0 && stickyPriceBox.x + stickyPriceBox.width <= viewport.width, '월요금 영역이 모바일 화면 밖으로 잘립니다.');
  assert(stickyApplyBox && stickyApplyBox.x >= 0 && stickyApplyBox.x + stickyApplyBox.width <= viewport.width, '신청하기 버튼이 모바일 화면 밖으로 잘립니다.');
  assert(stickyConsultBox && stickyConsultBox.x >= 0 && stickyConsultBox.x + stickyConsultBox.width <= viewport.width, '상담하기 버튼이 모바일 화면 밖으로 잘립니다.');

  // 작은 모바일 화면에서도 AI 모달이 가로로 넘치지 않는지 추가 점검합니다.
  const compactContext = await browser.newContext({viewport:{width:375,height:667},isMobile:true,hasTouch:true});
  const compactPage = await compactContext.newPage();
  await compactPage.goto('http://127.0.0.1:4173/rental/', {waitUntil:'domcontentloaded'});
  await compactPage.waitForSelector('.recommend-card', {timeout:15000});
  await compactPage.locator('[data-ai-recommend-open]').first().click();
  await compactPage.waitForSelector('#ai-recommend-dialog[open]');
  const compactOverflow = await compactPage.evaluate(() => {
    const dialog = document.querySelector('#ai-recommend-dialog');
    const panel = document.querySelector('.ai-recommend-panel');
    return {
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      dialog: dialog ? dialog.scrollWidth - dialog.clientWidth : 999,
      panel: panel ? panel.scrollWidth - panel.clientWidth : 999
    };
  });
  assert(compactOverflow.page <= 1 && compactOverflow.dialog <= 1 && compactOverflow.panel <= 1, '375px 모바일에서 AI 추천창이 가로로 넘칩니다.');
  await compactContext.close();

  console.log('Rental mobile smoke test passed.');
  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
