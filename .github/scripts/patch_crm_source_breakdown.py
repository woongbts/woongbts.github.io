from pathlib import Path

worker = Path('.github/crm/src/worker.js')
app = Path('.github/crm/web/app.js')

w = worker.read_text(encoding='utf-8')
old = "const [todayRow, weekRow, monthRow, topPages, topSources, devices, conversions, conversionSources] = await Promise.all(["
new = "const [todayRow, weekRow, monthRow, topPages, topSources, sourceBreakdown, devices, conversions, conversionSources] = await Promise.all(["
if old not in w:
    raise SystemExit('worker destructuring anchor not found')
w = w.replace(old, new, 1)

old = "    env.DB.prepare('SELECT source,SUM(visits) visits FROM site_analytics_sources WHERE day BETWEEN ? AND ? GROUP BY source ORDER BY visits DESC LIMIT 5').bind(from30,today).all(),\n"
new = old + "    env.DB.prepare(`SELECT\n      COALESCE(SUM(CASE WHEN source='direct' THEN visits ELSE 0 END),0) direct,\n      COALESCE(SUM(CASE WHEN source LIKE '%google.%' OR source LIKE '%googleusercontent.%' THEN visits ELSE 0 END),0) google,\n      COALESCE(SUM(CASE WHEN source LIKE '%naver.%' THEN visits ELSE 0 END),0) naver,\n      COALESCE(SUM(CASE WHEN source LIKE '%instagram.%' THEN visits ELSE 0 END),0) instagram,\n      COALESCE(SUM(CASE WHEN source<>'direct'\n        AND source NOT LIKE '%google.%'\n        AND source NOT LIKE '%googleusercontent.%'\n        AND source NOT LIKE '%naver.%'\n        AND source NOT LIKE '%instagram.%' THEN visits ELSE 0 END),0) other\n      FROM site_analytics_sources WHERE day BETWEEN ? AND ?`).bind(from30,today).first(),\n"
if old not in w:
    raise SystemExit('worker source query anchor not found')
w = w.replace(old, new, 1)

old = "    top_sources:(topSources.results||[]).map(r=>({source:r.source,visits:Number(r.visits||0)})),\n"
new = old + "    source_breakdown:{\n      direct:Number(sourceBreakdown?.direct||0),\n      google:Number(sourceBreakdown?.google||0),\n      naver:Number(sourceBreakdown?.naver||0),\n      instagram:Number(sourceBreakdown?.instagram||0),\n      other:Number(sourceBreakdown?.other||0)\n    },\n"
if old not in w:
    raise SystemExit('worker return anchor not found')
w = w.replace(old, new, 1)
worker.write_text(w, encoding='utf-8')

a = app.read_text(encoding='utf-8')
old = "    const sourceNames={direct:'직접 방문',internal:'사이트 내부',other:'기타'};\n    const topPage=site.top_pages?.[0], topSource=site.top_sources?.[0];\n    $('site-analytics-note').textContent = Number(site.last30?.pageviews||0)\n      ? `최근 30일 페이지 조회 ${Number(site.last30.pageviews).toLocaleString('ko-KR')}회 · 인기 페이지 ${pageNames[topPage?.path]||topPage?.path||'-'} · 주요 유입 ${sourceNames[topSource?.source]||topSource?.source||'-'}`\n      : '오늘부터 방문 통계를 집계합니다. 이름·전화번호·IP 주소는 방문통계 DB에 저장하지 않습니다.';\n"
new = "    const sourceNames={direct:'직접 방문',internal:'사이트 내부',other:'기타'};\n    const topPage=site.top_pages?.[0];\n    const sourceBreakdown=site.source_breakdown||{};\n    const sourceText=[\n      `직접 방문 ${Number(sourceBreakdown.direct||0).toLocaleString('ko-KR')}회`,\n      `Google ${Number(sourceBreakdown.google||0).toLocaleString('ko-KR')}회`,\n      `Naver ${Number(sourceBreakdown.naver||0).toLocaleString('ko-KR')}회`,\n      `Instagram ${Number(sourceBreakdown.instagram||0).toLocaleString('ko-KR')}회`,\n      `기타 ${Number(sourceBreakdown.other||0).toLocaleString('ko-KR')}회`\n    ].join(' · ');\n    $('site-analytics-note').textContent = Number(site.last30?.pageviews||0)\n      ? `최근 30일 페이지 조회 ${Number(site.last30.pageviews).toLocaleString('ko-KR')}회 · 인기 페이지 ${pageNames[topPage?.path]||topPage?.path||'-'} · 유입경로 ${sourceText}`\n      : `최근 30일 유입경로 ${sourceText} · 이름·전화번호·IP 주소는 방문통계 DB에 저장하지 않습니다.`;\n"
if old not in a:
    raise SystemExit('app analytics note anchor not found')
a = a.replace(old, new, 1)
app.write_text(a, encoding='utf-8')
print('patched CRM source breakdown')
