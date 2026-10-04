const { chromium, devices } = require('playwright');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const browser = await chromium.launch({headless:true});
  const context = await browser.newContext({...devices['iPhone 14']});
  const page = await context.newPage();
  let fullCatalogRequests = 0;
  let submittedRentalBody = null;
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
    try { submittedRentalBody = JSON.parse(route.request().postData() || '{}'); } catch (_) { submittedRentalBody = null; }
    return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':origin},body:JSON.stringify({ok:true,receipt:{id:'00000000-test',submitted_at:new Date().toISOString(),status:'접수완료'}})});
  });
  await page.addInitScript(() => {
    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async text => sessionStorage.setItem('wb_test_clipboard', String(text)) }
      });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async data => sessionStorage.setItem('wb_test_share', JSON.stringify(data || {}))
      });
    } catch (_) {}
  });

  await page.goto('http://127.0.0.1:4173/rental/?utm_source=naver&utm_campaign=smoke-test', {waitUntil:'domcontentloaded'});
  await page.waitForSelector('.recommend-card', {timeout:15000});

  assert(fullCatalogRequests === 0, '첫 화면에서 전체 products.json을 미리 불러오고 있습니다.');
  const policyText = await page.locator('[data-policy-month]').first().textContent();
  assert(/\d{4}년 \d{1,2}월 기준/.test(policyText || ''), '정책 기준월 자동 표시가 동작하지 않습니다.');
  const acquisition = await page.evaluate(() => window.woongbiSiteAnalyticsContext?.());
  assert(acquisition?.source === 'naver-search' && acquisition?.campaign === 'smoke-test', '렌탈 유입경로 추적이 동작하지 않습니다.');
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
  assert(await page.locator('#rental-guides').count() === 1, '렌탈 카테고리 가이드 섹션이 없습니다.');
  assert(await page.locator('#trust').count() === 1, '웅비렌탈 안심 상담 섹션이 없습니다.');
  const guideHref = await page.locator('#rental-guides a[href="water-purifier/"]').getAttribute('href');
  assert(guideHref === 'water-purifier/', '정수기 SEO 가이드 링크가 올바르지 않습니다.');
  assert(await page.locator('.rental-card-guide-box a[href="cards/"]').count() === 1, '메인 제휴카드 비교 링크가 없습니다.');


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
  await page.locator('[data-ai-quote]').first().click();
  await page.waitForSelector('#ai-quote-dialog[open]');
  const quoteText = await page.locator('#ai-quote-content').textContent();
  assert(quoteText.includes('한눈견적') && quoteText.includes('월 렌탈료') && quoteText.includes('12개월 이내'), '한눈견적 카드 내용이 올바르지 않습니다.');
  await page.locator('[data-ai-quote-copy]').first().click();
  await page.waitForTimeout(50);
  const quoteCopied = await page.evaluate(() => sessionStorage.getItem('wb_test_clipboard') || '');
  assert(quoteCopied.includes('[웅비렌탈 한눈견적]') && quoteCopied.includes('고객사은품:'), '한눈견적 복사가 동작하지 않습니다.');
  await page.locator('.ai-quote-close').click();

  await page.locator('[data-ai-share]').click();
  await page.waitForTimeout(50);
  const sharedData = await page.evaluate(() => JSON.parse(sessionStorage.getItem('wb_test_share') || '{}'));
  assert(sharedData.url && /[?&]ai=1/.test(sharedData.url) && /[?&]cat=/.test(sharedData.url), 'AI 추천 공유 링크가 조건을 포함하지 않습니다.');

  await page.locator('[data-ai-feedback="up"]').click();
  assert(await page.locator('[data-ai-feedback="up"].active').count() === 1, 'AI 추천 피드백이 반영되지 않습니다.');
  await page.locator('[data-ai-kakao]').evaluate(el => el.addEventListener('click', e => e.preventDefault()));
  await page.locator('[data-ai-kakao]').click();
  await page.waitForTimeout(80);
  const aiCopied = await page.evaluate(() => sessionStorage.getItem('wb_test_clipboard') || '');
  assert(aiCopied.includes('[웅비렌탈 AI 추천 상담]') && aiCopied.includes('추천 결과'), 'AI 추천 카카오 상담 복사가 동작하지 않습니다.');
  const aiEvents = await page.evaluate(() => JSON.parse(localStorage.getItem('wb_conversion_events_v1') || '[]').map(x => x.type));
  assert(aiEvents.includes('rental_ai_open') && aiEvents.includes('rental_ai_recommend') && aiEvents.includes('rental_ai_compare') && aiEvents.includes('rental_ai_kakao') && aiEvents.includes('rental_ai_share') && aiEvents.includes('rental_ai_feedback') && aiEvents.includes('rental_quote_open') && aiEvents.includes('rental_quote_share'), 'AI 전환 이벤트 기록이 누락되었습니다.');
  await page.locator('#ai-recommend-close').click();
  await page.evaluate(() => {
    localStorage.removeItem('wb_rental_compare_v1');
    document.getElementById('compare-bar')?.remove();
  });
  const sharedUrl = await page.evaluate(() => JSON.parse(sessionStorage.getItem('wb_test_share') || '{}').url || '');
  await page.goto(sharedUrl, {waitUntil:'domcontentloaded'});
  await page.waitForSelector('#ai-recommend-dialog[open]');
  await page.waitForSelector('.ai-result-card');
  const sharedStatus = await page.locator('#ai-recommend-status').textContent();
  assert(sharedStatus.includes('공유된 추천 조건'), '공유된 AI 추천 링크가 같은 조건으로 복원되지 않습니다.');
  await page.locator('#ai-recommend-close').click();

  await page.goto('http://127.0.0.1:4173/rental/water-purifier/', {waitUntil:'domcontentloaded'});
  const categoryCanonical = await page.locator('link[rel="canonical"]').getAttribute('href');
  assert(categoryCanonical === 'https://woongbts.github.io/rental/water-purifier/', '정수기 카테고리 canonical이 올바르지 않습니다.');
  assert(await page.locator('.category-product').count() >= 1, '정수기 카테고리 SEO 페이지에 상품이 없습니다.');
  const categoryAiHref = await page.locator('.category-hero-actions .primary').getAttribute('href');
  assert(categoryAiHref && categoryAiHref.includes('ai=1') && categoryAiHref.includes('cat='), '카테고리 페이지 AI 추천 연결이 없습니다.');

  await page.goto('http://127.0.0.1:4173/rental/cards/', {waitUntil:'domcontentloaded'});
  await page.waitForSelector('.affiliate-card');
  const cardPathBefore = new URL(page.url()).pathname;
  await page.locator('#card-compare-jump').click();
  await page.waitForTimeout(180);
  const cardPathAfter = new URL(page.url()).pathname;
  assert(cardPathBefore === '/rental/cards/' && cardPathAfter === '/rental/cards/', '카드 비교하기 클릭 시 렌탈 홈으로 이동합니다.');
  const cardTargetTop = await page.locator('#affiliate-cards').evaluate(el => el.getBoundingClientRect().top);
  assert(cardTargetTop < 220, '카드 비교하기 클릭 시 제휴카드 목록으로 이동하지 않습니다.');
  assert(await page.locator('#card-provider-tabs button').count() >= 8, '제휴카드 렌탈사 탭이 충분히 표시되지 않습니다.');
  const cardPageText = await page.locator('#affiliate-cards').textContent();
  assert(cardPageText.includes('코웨이') && cardPageText.includes('전월') && cardPageText.includes('할인'), '제휴카드 비교 정보가 표시되지 않습니다.');
  await page.locator('.card-detail').first().evaluate(el => { el.open = true; });
  const cardDetailPageText = await page.locator('.card-detail').first().textContent();
  assert(cardDetailPageText.includes('발급') || cardDetailPageText.includes('프로모션'), '제휴카드 비교 페이지에 상세 발급조건이 없습니다.');

  await page.goto('http://127.0.0.1:4173/rental/', {waitUntil:'domcontentloaded'});
  await page.waitForSelector('.recommend-card', {timeout:15000});
  await page.locator('[data-recommend-sort="monthly"]').click();
  assert(await page.locator('[data-recommend-sort="monthly"]').getAttribute('aria-pressed') === 'true', '월요금 정렬 버튼이 동작하지 않습니다.');
  await page.locator('[data-recommend-sort="gift"]').click();
  assert(await page.locator('[data-recommend-sort="gift"]').getAttribute('aria-pressed') === 'true', '사은품 정렬 버튼이 동작하지 않습니다.');
  await page.locator('[data-recommend-sort="recommend"]').click();
  assert(await page.locator('.recommend-preference').count() === 0, '고객 선호 순위 라벨이 추천상품에 노출됩니다.');

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

  const aiApplyUrl = new URL(applyHref, 'http://127.0.0.1:4173/rental/').toString();
  const aiApplyParams = new URL(aiApplyUrl).searchParams;
  await page.goto(aiApplyUrl, {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => document.querySelector('#monthly-fee')?.textContent !== '-');
  await page.waitForSelector('#rental-apply-dialog[open]');
  const selectedManagement = await page.locator('#generic-management button.active').getAttribute('data-value');
  const selectedTerm = await page.locator('#generic-term button.active').getAttribute('data-value');
  assert(selectedManagement === aiApplyParams.get('mgmt') && selectedTerm === aiApplyParams.get('term'), 'AI 추천 조건이 상세페이지에 그대로 선택되지 않았습니다.');
  const cleanCanonical = await page.locator('#product-canonical').getAttribute('href');
  assert(cleanCanonical && /\/rental\/product\/[^/]+\/$/.test(cleanCanonical), '깨끗한 상품 URL canonical이 동작하지 않습니다.');
  await page.locator('#rental-apply-close').click();

  await page.goto('http://127.0.0.1:4173/rental/product.html?id=clv-10316', {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => {
    const el = document.querySelector('#monthly-fee');
    return el && el.textContent && el.textContent !== '-';
  }, null, {timeout:15000});

  const recentStored = await page.evaluate(() => JSON.parse(localStorage.getItem('wb_rental_recent_v1') || '[]').some(x => x.id === 'clv-10316'));
  assert(recentStored, '최근 본 상품 저장이 동작하지 않습니다.');
  const canonical = await page.locator('#product-canonical').getAttribute('href');
  assert(canonical && canonical.includes('/rental/product/clv-10316/'), '상품 canonical URL이 깨끗한 상품 경로로 갱신되지 않았습니다.');
  const freshnessText = await page.locator('#product-freshness').textContent();
  assert(/최근 정책 확인 \d{4}\.\d{2}\.\d{2}/.test(freshnessText || ''), '상품 정책 확인일 표시가 없습니다.');
  assert(await page.locator('.product-trust-section').count() === 1, '상품 상세 안심 상담 영역이 없습니다.');
  const generatedDescription = await page.locator('#generic-description').textContent();
  assert(generatedDescription && generatedDescription.includes('비교'), '웅비렌탈 자체 상품 설명이 생성되지 않았습니다.');
  assert(await page.locator('#generic-recommend-audience span').count() >= 1, '이런 분께 추천 영역이 생성되지 않았습니다.');
  const cardPreviewCount = await page.locator('#affiliate-card-preview article').count();
  assert(cardPreviewCount >= 1 || await page.locator('#affiliate-card-section[hidden]').count() === 1, '상품별 제휴카드 미리보기 상태가 올바르지 않습니다.');
  await page.goto('http://127.0.0.1:4173/rental/product/chp-7220n/', {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => document.querySelector('#monthly-fee')?.textContent !== '-');
  await page.waitForSelector('#generic-card-row:not([hidden])');
  const cowayMonthly = Number((await page.locator('#monthly-fee').textContent()).replace(/[^0-9]/g,''));
  const cowayCardMonthly = Number((await page.locator('#card-fee').textContent()).replace(/[^0-9]/g,''));
  const cowayCardNote = await page.locator('#card-fee-note').textContent();
  assert(cowayMonthly > 0 && cowayCardMonthly === Math.max(0,cowayMonthly - 13000), '코웨이 대표 제휴카드 예상 월요금 계산이 올바르지 않습니다.');
  assert(cowayCardNote.includes('전월 30만원') && cowayCardNote.includes('13,000원 할인'), '제휴카드 예상 월요금 계산 근거가 표시되지 않습니다.');
  await page.locator('#card-fee-more').scrollIntoViewIfNeeded();
  const cardScrollBefore = await page.evaluate(() => window.scrollY);
  await page.locator('#card-fee-more').click();
  await page.waitForSelector('#affiliate-card-dialog[open]');
  const cardDialogText = await page.locator('#affiliate-card-dialog').textContent();
  assert(cardDialogText.includes('코웨이 ICON 우리카드') && cardDialogText.includes('발급·실적·유의사항') && cardDialogText.includes('자동납부') && cardDialogText.includes('2026년 10월 신규발급 추가 할인'), '제휴카드 상세 발급조건/유의사항이 표시되지 않습니다.');
  const cardScrollAfter = await page.evaluate(() => window.scrollY);
  assert(Math.abs(cardScrollAfter - cardScrollBefore) <= 2, '카드조건 보기 클릭 시 페이지가 먼 위치로 이동합니다.');
  await page.locator('#affiliate-card-dialog-close').click();
  await page.locator('.affiliate-card-tier').nth(1).click();
  const selectedCardNote = await page.locator('#card-fee-note').textContent();
  assert(selectedCardNote && selectedCardNote.includes('할인'), '제휴카드 실적 선택 시 예상 월요금이 갱신되지 않습니다.');
  const jsonLd = await page.locator('#product-jsonld').textContent();
  assert(jsonLd && jsonLd.includes('"Product"'), '상품 구조화 데이터가 생성되지 않았습니다.');

  await page.locator('#rental-apply-open').click();
  assert(await page.locator('#rental-apply-dialog[open]').count() === 1, '온라인 렌탈 신청창이 열리지 않습니다.');
  assert(await page.locator('#rental-apply-company').count() === 1, '신청 스팸 방지 honeypot 필드가 없습니다.');
  const honeypotBox = await page.locator('#rental-apply-company').boundingBox();
  assert(!honeypotBox || honeypotBox.x < 0 || honeypotBox.width <= 1, 'honeypot 필드가 고객 화면에 노출됩니다.');
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
  await page.waitForTimeout(700);
  await page.locator('#rental-apply-submit').click();
  await page.waitForSelector('#rental-apply-success-dialog[open]');
  assert(submittedRentalBody && submittedRentalBody.product_url && /[?&]src=naver-search/.test(submittedRentalBody.product_url), '렌탈 신청에 유입경로가 이어지지 않습니다.');
  assert(await page.locator('#rental-apply-dialog[open]').count() === 0, '신청 성공 후 입력창이 닫히지 않습니다.');
  const successTitle = await page.locator('#rental-apply-success-title').textContent();
  const successMessage = await page.locator('#rental-apply-success-dialog p').textContent();
  assert(successTitle.includes('신청이 접수되었습니다') && successMessage.includes('확인 후 연락드리겠습니다'), '신청 완료 팝업 문구가 올바르지 않습니다.');
  const applySuccess = await page.evaluate(() => JSON.parse(localStorage.getItem('wb_conversion_events_v1') || '[]').some(x => x.type === 'rental_apply_success'));
  assert(applySuccess, '렌탈 신청 성공 전환 이벤트가 기록되지 않았습니다.');
  const crmSaved = await page.evaluate(() => JSON.parse(localStorage.getItem('wb_rental_crm_v1') || '[]')[0] || null);
  assert(crmSaved && crmSaved.id && crmSaved.status === '접수' && !('phone' in crmSaved) && !('name' in crmSaved), '개인정보 없는 CRM 신청상태 저장이 동작하지 않습니다.');
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

  await page.goto('http://127.0.0.1:4173/rental/ops/', {waitUntil:'domcontentloaded'});
  assert(await page.locator('meta[name="robots"]').getAttribute('content') === 'noindex,nofollow,noarchive', '운영자 대시보드가 검색 차단되지 않았습니다.');
  await page.waitForSelector('#ops-kpis .ops-kpi');
  assert(await page.locator('#ops-funnel .ops-stage').count() === 6, '운영자 대시보드 전환 퍼널이 표시되지 않습니다.');
  assert(await page.locator('#ops-crm .ops-crm-row').count() >= 1, '운영자 대시보드 CRM 진행상태가 표시되지 않습니다.');
  await page.locator('#ops-crm select').first().selectOption('상담중');
  const crmStatus = await page.evaluate(() => JSON.parse(localStorage.getItem('wb_rental_crm_v1') || '[]')[0]?.status || '');
  assert(crmStatus === '상담중', 'CRM 진행상태 변경이 저장되지 않습니다.');
  assert(await page.locator('#ops-verification .ops-list-row').count() >= 3, '상품 데이터 확인상태가 표시되지 않습니다.');

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
