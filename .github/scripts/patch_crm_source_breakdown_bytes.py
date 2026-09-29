from pathlib import Path


def replace_once(data: bytes, old: str, new: str, label: str) -> bytes:
    old_b = old.encode('utf-8')
    new_b = new.encode('utf-8')
    count = data.count(old_b)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return data.replace(old_b, new_b, 1)

worker = Path('.github/crm/src/worker.js')
data = worker.read_bytes()
data = replace_once(
    data,
    "const [todayRow, weekRow, monthRow, topPages, topSources, devices, conversions, conversionSources] = await Promise.all([",
    "const [todayRow, weekRow, monthRow, topPages, topSources, sourceBreakdown, devices, conversions, conversionSources] = await Promise.all([",
    'worker destructuring'
)
source_query = "    env.DB.prepare('SELECT source,SUM(visits) visits FROM site_analytics_sources WHERE day BETWEEN ? AND ? GROUP BY source ORDER BY visits DESC LIMIT 5').bind(from30,today).all(),"
source_breakdown_query = "    env.DB.prepare(`SELECT COALESCE(SUM(CASE WHEN source='direct' THEN visits ELSE 0 END),0) direct, COALESCE(SUM(CASE WHEN source LIKE '%google.%' OR source LIKE '%googleusercontent.%' THEN visits ELSE 0 END),0) google, COALESCE(SUM(CASE WHEN source LIKE '%naver.%' THEN visits ELSE 0 END),0) naver, COALESCE(SUM(CASE WHEN source LIKE '%instagram.%' THEN visits ELSE 0 END),0) instagram, COALESCE(SUM(CASE WHEN source<>'direct' AND source NOT LIKE '%google.%' AND source NOT LIKE '%googleusercontent.%' AND source NOT LIKE '%naver.%' AND source NOT LIKE '%instagram.%' THEN visits ELSE 0 END),0) other FROM site_analytics_sources WHERE day BETWEEN ? AND ?`).bind(from30,today).first(),"
data = replace_once(data, source_query, source_query + "\n" + source_breakdown_query, 'worker source query')
return_anchor = "    top_sources:(topSources.results||[]).map(r=>({source:r.source,visits:Number(r.visits||0)})),"
return_insert = return_anchor + "\n    source_breakdown:{direct:Number(sourceBreakdown?.direct||0),google:Number(sourceBreakdown?.google||0),naver:Number(sourceBreakdown?.naver||0),instagram:Number(sourceBreakdown?.instagram||0),other:Number(sourceBreakdown?.other||0)},"
data = replace_once(data, return_anchor, return_insert, 'worker return')
worker.write_bytes(data)

app = Path('.github/crm/web/app.js')
data = app.read_bytes()
data = replace_once(
    data,
    "    const topPage=site.top_pages?.[0], topSource=site.top_sources?.[0];",
    "    const topPage=site.top_pages?.[0]; const sourceBreakdown=site.source_breakdown||{}; const sourceText=[`직접 방문 ${Number(sourceBreakdown.direct||0).toLocaleString('ko-KR')}회`,`Google ${Number(sourceBreakdown.google||0).toLocaleString('ko-KR')}회`,`Naver ${Number(sourceBreakdown.naver||0).toLocaleString('ko-KR')}회`,`Instagram ${Number(sourceBreakdown.instagram||0).toLocaleString('ko-KR')}회`,`기타 ${Number(sourceBreakdown.other||0).toLocaleString('ko-KR')}회`].join(' · ');",
    'app source summary'
)
data = replace_once(
    data,
    " · 주요 유입 ${sourceNames[topSource?.source]||topSource?.source||'-'}`",
    " · 유입경로 ${sourceText}`",
    'app analytics primary text'
)
data = replace_once(
    data,
    "      : '오늘부터 방문 통계를 집계합니다. 이름·전화번호·IP 주소는 방문통계 DB에 저장하지 않습니다.';",
    "      : `최근 30일 유입경로 ${sourceText} · 이름·전화번호·IP 주소는 방문통계 DB에 저장하지 않습니다.`;",
    'app analytics empty text'
)
app.write_bytes(data)
print('patched CRM source breakdown without normalizing line endings')
