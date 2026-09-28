from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    raw = p.read_bytes()
    matches = []
    for newline in ('\r\n', '\n'):
        old_b = old.replace('\n', newline).encode('utf-8')
        count = raw.count(old_b)
        if count:
            matches.append((newline, old_b, count))
    total = sum(count for _, _, count in matches)
    if total != 1:
        raise SystemExit(f'{path}: expected exactly one match, got {total}')
    newline, old_b, _ = matches[0]
    new_b = new.replace('\n', newline).encode('utf-8')
    p.write_bytes(raw.replace(old_b, new_b, 1))


worker = '.github/crm/src/worker.js'
replace_once(
    worker,
    """    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_site_analytics_seen_created ON site_analytics_seen(created_at)')
  ]);""",
    """    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_site_analytics_seen_created ON site_analytics_seen(created_at)'),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS site_conversion_daily (
      day TEXT NOT NULL,
      event TEXT NOT NULL,
      path TEXT NOT NULL,
      source TEXT NOT NULL,
      device TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(day,event,path,source,device)
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_site_conversion_event_day ON site_conversion_daily(event,day)')
  ]);""",
)
replace_once(
    worker,
    """  const [todayRow, weekRow, monthRow, topPages, topSources, devices] = await Promise.all([""",
    """  const [todayRow, weekRow, monthRow, topPages, topSources, devices, conversions, conversionSources] = await Promise.all([""",
)
replace_once(
    worker,
    """    env.DB.prepare('SELECT device,SUM(visits) visits FROM site_analytics_devices WHERE day BETWEEN ? AND ? GROUP BY device ORDER BY visits DESC').bind(from30,today).all()
  ]);""",
    """    env.DB.prepare('SELECT device,SUM(visits) visits FROM site_analytics_devices WHERE day BETWEEN ? AND ? GROUP BY device ORDER BY visits DESC').bind(from30,today).all(),
    env.DB.prepare('SELECT event,SUM(count) count FROM site_conversion_daily WHERE day BETWEEN ? AND ? GROUP BY event ORDER BY count DESC').bind(from30,today).all(),
    env.DB.prepare(`SELECT source,SUM(count) count FROM site_conversion_daily
      WHERE day BETWEEN ? AND ? AND event IN ('phone_click','kakao_click','booking_click','consult_click','ai_phone_click','ai_kakao_click')
      GROUP BY source ORDER BY count DESC LIMIT 5`).bind(from30,today).all()
  ]);""",
)
replace_once(
    worker,
    """    top_sources:(topSources.results||[]).map(r=>({source:r.source,visits:Number(r.visits||0)})),
    devices:(devices.results||[]).map(r=>({device:r.device,visits:Number(r.visits||0)}))
  };""",
    """    top_sources:(topSources.results||[]).map(r=>({source:r.source,visits:Number(r.visits||0)})),
    devices:(devices.results||[]).map(r=>({device:r.device,visits:Number(r.visits||0)})),
    conversions:Object.fromEntries((conversions.results||[]).map(r=>[r.event,Number(r.count||0)])),
    conversion_sources:(conversionSources.results||[]).map(r=>({source:r.source,count:Number(r.count||0)}))
  };""",
)

app = '.github/crm/web/app.js'
replace_once(
    app,
    """    $('stat-site-30d-visits').textContent = Number(site.last30?.visits||0).toLocaleString('ko-KR');
    const pageNames={'/':'홈','/rates.html':'요금 알아보기','/links.html':'블로그·SNS'};""",
    """    $('stat-site-30d-visits').textContent = Number(site.last30?.visits||0).toLocaleString('ko-KR');
    const conversion = site.conversions || {};
    const conversionValue = event => Number(conversion[event] || 0);
    $('stat-conv-phone').textContent = conversionValue('phone_click').toLocaleString('ko-KR');
    $('stat-conv-kakao').textContent = conversionValue('kakao_click').toLocaleString('ko-KR');
    $('stat-conv-booking').textContent = conversionValue('booking_click').toLocaleString('ko-KR');
    $('stat-conv-rate').textContent = conversionValue('rate_open').toLocaleString('ko-KR');
    $('stat-conv-consult').textContent = conversionValue('consult_click').toLocaleString('ko-KR');
    $('stat-conv-ai-open').textContent = conversionValue('ai_open').toLocaleString('ko-KR');
    $('stat-conv-ai-question').textContent = conversionValue('ai_question').toLocaleString('ko-KR');
    const aiPhone = conversionValue('ai_phone_click');
    const aiKakao = conversionValue('ai_kakao_click');
    $('stat-conv-ai-consult').textContent = (aiPhone + aiKakao).toLocaleString('ko-KR');
    const pageNames={'/':'홈','/rates.html':'요금 알아보기','/links.html':'블로그·SNS','/manduk-mobile.html':'만덕 상담 안내'};""",
)
replace_once(
    app,
    """      : '오늘부터 방문 통계를 집계합니다. 이름·전화번호·IP 주소는 방문통계 DB에 저장하지 않습니다.';
    await loadCustomers();""",
    """      : '오늘부터 방문 통계를 집계합니다. 이름·전화번호·IP 주소는 방문통계 DB에 저장하지 않습니다.';
    const consultTotal = conversionValue('phone_click') + conversionValue('kakao_click') + conversionValue('booking_click') + conversionValue('consult_click') + aiPhone + aiKakao;
    const sourceSummary = (site.conversion_sources || []).slice(0, 3)
      .map(item => `${sourceNames[item.source] || item.source || '-'} ${Number(item.count || 0).toLocaleString('ko-KR')}회`)
      .join(' · ');
    $('site-conversion-note').textContent = consultTotal
      ? `최근 30일 상담 관련 행동 ${consultTotal.toLocaleString('ko-KR')}회${sourceSummary ? ` · 주요 전환 유입 ${sourceSummary}` : ''} · AI 상담 전환 전화 ${aiPhone.toLocaleString('ko-KR')}회 / 카카오 ${aiKakao.toLocaleString('ko-KR')}회`
      : '전환 행동이 쌓이면 전화·카카오·예약·요금조회·AI 이용과 주요 유입경로를 최근 30일 기준으로 보여줍니다.';
    await loadCustomers();""",
)

html = '.github/crm/web/index.html'
replace_once(
    html,
    """    <p id="site-analytics-note" class="sub">오늘부터 방문 통계를 집계합니다. 이름·전화번호·IP 주소는 방문통계 DB에 저장하지 않습니다.</p>

    <nav class="tabs" aria-label="CRM 메뉴">""",
    """    <p id="site-analytics-note" class="sub">오늘부터 방문 통계를 집계합니다. 이름·전화번호·IP 주소는 방문통계 DB에 저장하지 않습니다.</p>

    <h2>홈페이지 전환 통계 <small class="sub">최근 30일</small></h2>
    <section class="stats" aria-label="최근 30일 홈페이지 전환 현황">
      <article><small>전화 클릭</small><b id="stat-conv-phone">-</b></article>
      <article><small>카카오 클릭</small><b id="stat-conv-kakao">-</b></article>
      <article><small>네이버예약 클릭</small><b id="stat-conv-booking">-</b></article>
      <article><small>요금조회 열기</small><b id="stat-conv-rate">-</b></article>
      <article><small>상담 버튼</small><b id="stat-conv-consult">-</b></article>
      <article><small>AI 열기</small><b id="stat-conv-ai-open">-</b></article>
      <article><small>AI 질문</small><b id="stat-conv-ai-question">-</b></article>
      <article><small>AI → 상담</small><b id="stat-conv-ai-consult">-</b></article>
    </section>
    <p id="site-conversion-note" class="sub">최근 30일 전환 통계를 불러오는 중입니다.</p>

    <nav class="tabs" aria-label="CRM 메뉴">""",
)
