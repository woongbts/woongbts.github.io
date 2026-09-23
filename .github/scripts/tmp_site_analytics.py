from pathlib import Path


def load(path):
    raw = Path(path).read_bytes().decode('utf-8')
    nl = '\r\n' if '\r\n' in raw else '\n'
    return raw.replace('\r\n', '\n'), nl


def save(path, text, nl='\n'):
    if nl == '\r\n':
        text = text.replace('\n', '\r\n')
    Path(path).write_bytes(text.encode('utf-8'))


# CRM Worker: aggregate-only analytics + short-lived session dedupe.
path = '.github/crm/src/worker.js'
text, nl = load(path)
old = "  async scheduled(event, env) { await ensureSchema(env); await intakeHandlers.purge(env); },"
new = "  async scheduled(event, env) { await ensureSchema(env); await intakeHandlers.purge(env); await purgeSiteAnalyticsSeen(env); },"
if old not in text:
    raise SystemExit('scheduled anchor missing')
text = text.replace(old, new, 1)
anchor = "    await ensureConsentSchema(env);\n    await intakeHandlers.ensure(env);"
if anchor not in text:
    raise SystemExit('schema anchor missing')
text = text.replace(anchor, "    await ensureConsentSchema(env);\n    await ensureSiteAnalyticsSchema(env);\n    await intakeHandlers.ensure(env);", 1)

start = text.index('async function dashboard(env) {')
end = text.index('\nfunction normalizePersonName', start)
dashboard = r'''async function dashboard(env) {
  const now = new Date();
  const from = isoMonthsAgo(now, 30);
  const to = isoMonthsAgo(now, 22);
  const [total, due, consent, siteAnalytics] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) count FROM customers WHERE customer_status='active'").first(),
    env.DB.prepare("SELECT COUNT(*) count FROM customers WHERE customer_status='active' AND opened_on BETWEEN ? AND ?")
      .bind(from, to).first(),
    env.DB.prepare(`SELECT
      SUM(CASE WHEN latest='granted' THEN 1 ELSE 0 END) granted,
      SUM(CASE WHEN latest='revoked' THEN 1 ELSE 0 END) revoked,
      SUM(CASE WHEN latest='unknown' THEN 1 ELSE 0 END) unknown
      FROM (
        SELECT c.id, COALESCE((SELECT status FROM consents x WHERE x.customer_id=c.id AND x.purpose='ad_sms' ORDER BY captured_at DESC, created_at DESC LIMIT 1),'unknown') latest
        FROM customers c WHERE c.customer_status='active'
      )`).first(),
    analyticsDashboard(env)
  ]);
  return json({
    ok: true,
    total: Number(total?.count || 0),
    maturity_22_30: Number(due?.count || 0),
    consent_granted: Number(consent?.granted || 0),
    consent_revoked: Number(consent?.revoked || 0),
    consent_unknown: Number(consent?.unknown || 0),
    site_analytics: siteAnalytics,
    sms_mode: env.SMS_MODE || 'dry_run'
  });
}

function kstDateKey(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit' }).format(value);
}

async function ensureSiteAnalyticsSchema(env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS site_analytics_daily (
      day TEXT PRIMARY KEY, visits INTEGER NOT NULL DEFAULT 0, pageviews INTEGER NOT NULL DEFAULT 0
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS site_analytics_pages (
      day TEXT NOT NULL, path TEXT NOT NULL, pageviews INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day,path)
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS site_analytics_sources (
      day TEXT NOT NULL, source TEXT NOT NULL, visits INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day,source)
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS site_analytics_devices (
      day TEXT NOT NULL, device TEXT NOT NULL, visits INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day,device)
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS site_analytics_seen (
      day TEXT NOT NULL, session_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(day,session_id)
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_site_analytics_seen_created ON site_analytics_seen(created_at)')
  ]);
}

async function siteAnalyticsCollect(env, body) {
  await ensureSchema(env);
  const sessionId = String(body?.session_id || '').trim();
  if (!/^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(sessionId)) {
    throw httpError(400, '방문 세션 형식이 올바르지 않습니다.');
  }
  const rawPath = String(body?.path || '').split('?')[0].slice(0, 120);
  const aliases = {'/index.html':'/','/':'/','/rates.html':'/rates.html','/links.html':'/links.html'};
  const pagePath = aliases[rawPath];
  if (!pagePath) throw httpError(400, '집계 대상 페이지가 아닙니다.');
  let source = String(body?.source || 'direct').trim().toLowerCase().slice(0,80);
  if (!/^(?:direct|internal|other|[a-z0-9.-]+)$/.test(source)) source = 'other';
  const device = ['mobile','tablet','desktop'].includes(body?.device) ? body.device : 'other';
  const now = new Date().toISOString();
  const day = kstDateKey(new Date());
  const seen = await env.DB.prepare('INSERT OR IGNORE INTO site_analytics_seen(day,session_id,created_at) VALUES(?,?,?)')
    .bind(day,sessionId,now).run();
  const firstVisit = Number(seen?.meta?.changes || 0) > 0 ? 1 : 0;
  const statements = [
    env.DB.prepare(`INSERT INTO site_analytics_daily(day,visits,pageviews) VALUES(?,?,1)
      ON CONFLICT(day) DO UPDATE SET visits=site_analytics_daily.visits+excluded.visits,pageviews=site_analytics_daily.pageviews+1`).bind(day,firstVisit),
    env.DB.prepare(`INSERT INTO site_analytics_pages(day,path,pageviews) VALUES(?,?,1)
      ON CONFLICT(day,path) DO UPDATE SET pageviews=site_analytics_pages.pageviews+1`).bind(day,pagePath)
  ];
  if (firstVisit) {
    statements.push(
      env.DB.prepare(`INSERT INTO site_analytics_sources(day,source,visits) VALUES(?,?,1)
        ON CONFLICT(day,source) DO UPDATE SET visits=site_analytics_sources.visits+1`).bind(day,source),
      env.DB.prepare(`INSERT INTO site_analytics_devices(day,device,visits) VALUES(?,?,1)
        ON CONFLICT(day,device) DO UPDATE SET visits=site_analytics_devices.visits+1`).bind(day,device)
    );
  }
  await env.DB.batch(statements);
  return {ok:true};
}

async function analyticsDashboard(env) {
  const today = kstDateKey(new Date());
  const from7 = kstDateKey(new Date(Date.now()-6*86400000));
  const from30 = kstDateKey(new Date(Date.now()-29*86400000));
  const [todayRow, weekRow, monthRow, topPages, topSources, devices] = await Promise.all([
    env.DB.prepare('SELECT visits,pageviews FROM site_analytics_daily WHERE day=?').bind(today).first(),
    env.DB.prepare('SELECT COALESCE(SUM(visits),0) visits,COALESCE(SUM(pageviews),0) pageviews FROM site_analytics_daily WHERE day BETWEEN ? AND ?').bind(from7,today).first(),
    env.DB.prepare('SELECT COALESCE(SUM(visits),0) visits,COALESCE(SUM(pageviews),0) pageviews FROM site_analytics_daily WHERE day BETWEEN ? AND ?').bind(from30,today).first(),
    env.DB.prepare('SELECT path,SUM(pageviews) pageviews FROM site_analytics_pages WHERE day BETWEEN ? AND ? GROUP BY path ORDER BY pageviews DESC LIMIT 5').bind(from30,today).all(),
    env.DB.prepare('SELECT source,SUM(visits) visits FROM site_analytics_sources WHERE day BETWEEN ? AND ? GROUP BY source ORDER BY visits DESC LIMIT 5').bind(from30,today).all(),
    env.DB.prepare('SELECT device,SUM(visits) visits FROM site_analytics_devices WHERE day BETWEEN ? AND ? GROUP BY device ORDER BY visits DESC').bind(from30,today).all()
  ]);
  return {
    today:{visits:Number(todayRow?.visits||0),pageviews:Number(todayRow?.pageviews||0)},
    last7:{visits:Number(weekRow?.visits||0),pageviews:Number(weekRow?.pageviews||0)},
    last30:{visits:Number(monthRow?.visits||0),pageviews:Number(monthRow?.pageviews||0)},
    top_pages:(topPages.results||[]).map(r=>({path:r.path,pageviews:Number(r.pageviews||0)})),
    top_sources:(topSources.results||[]).map(r=>({source:r.source,visits:Number(r.visits||0)})),
    devices:(devices.results||[]).map(r=>({device:r.device,visits:Number(r.visits||0)}))
  };
}

async function purgeSiteAnalyticsSeen(env) {
  const cutoff = kstDateKey(new Date(Date.now()-2*86400000));
  await env.DB.prepare('DELETE FROM site_analytics_seen WHERE day < ?').bind(cutoff).run();
}
'''
text = text[:start] + dashboard + text[end:]

class_anchor = "export class ConsentPublic extends WorkerEntrypoint {\n  async intakeForm() { return consentResult(()=>intakeHandlers.form()); }"
if class_anchor not in text:
    raise SystemExit('ConsentPublic anchor missing')
text = text.replace(class_anchor, "export class ConsentPublic extends WorkerEntrypoint {\n  async siteAnalyticsCollect(body) { return consentResult(()=>siteAnalyticsCollect(this.env,body)); }\n  async intakeForm() { return consentResult(()=>intakeHandlers.form()); }", 1)
save(path, text, nl)

# Public consent worker doubles as a narrowly-scoped analytics collector.
path = '.github/crm/src/consent-public.js'
text, nl = load(path)
helper_anchor = "function reply(body,status=200) {return new Response(JSON.stringify(body),{status,headers:{...headers,'content-type':'application/json; charset=utf-8'}});}\n"
if helper_anchor not in text:
    raise SystemExit('public reply anchor missing')
helpers = helper_anchor + "const SITE_ORIGIN='https://woongbts.github.io';\nfunction analyticsReply(body,status=200){return new Response(JSON.stringify(body),{status,headers:{...headers,'content-type':'application/json; charset=utf-8','access-control-allow-origin':SITE_ORIGIN,'vary':'Origin'}});}\n"
text = text.replace(helper_anchor, helpers, 1)
fetch_anchor = "    const url=new URL(request.url);\n    if(request.method==='GET' && url.pathname==='/api/intake-form') {"
if fetch_anchor not in text:
    raise SystemExit('public fetch anchor missing')
analytics_route = """    const url=new URL(request.url);
    if(url.pathname==='/api/site-analytics' && request.method==='OPTIONS') {
      if(request.headers.get('origin')!==SITE_ORIGIN) return new Response(null,{status:403,headers});
      return new Response(null,{status:204,headers:{...headers,'access-control-allow-origin':SITE_ORIGIN,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type','access-control-max-age':'86400','vary':'Origin'}});
    }
    if(url.pathname==='/api/site-analytics' && request.method==='POST') {
      if(request.headers.get('origin')!==SITE_ORIGIN) return analyticsReply({ok:false,error:'요청 출처를 확인할 수 없습니다.'},403);
      const type=request.headers.get('content-type')||'';
      if(!(type.startsWith('text/plain')||type.startsWith('application/json'))) return analyticsReply({ok:false,error:'요청 형식을 확인할 수 없습니다.'},415);
      try {
        if(env.ANALYTICS_LIMITER){const key=request.headers.get('CF-Connecting-IP')||'unknown';if(!(await env.ANALYTICS_LIMITER.limit({key})).success)return analyticsReply({ok:false,error:'요청이 잠시 많습니다.'},429);}
        const raw=await request.text(); if(raw.length>2048)return analyticsReply({ok:false,error:'요청이 너무 큽니다.'},413);
        const result=await env.CONSENT.siteAnalyticsCollect(JSON.parse(raw));
        return analyticsReply(result,result.ok?200:result.status||400);
      } catch {return analyticsReply({ok:false,error:'방문 통계를 기록하지 못했습니다.'},400);}
    }
    if(request.method==='GET' && url.pathname==='/api/intake-form') {"""
text = text.replace(fetch_anchor, analytics_route, 1)
save(path, text, nl)

# Dedicated public analytics rate limit.
path = '.github/crm/wrangler.consent.toml'
text, nl = load(path)
if 'ANALYTICS_LIMITER' not in text:
    text += "\n[[ratelimits]]\nname = \"ANALYTICS_LIMITER\"\nnamespace_id = \"1002\"\nsimple = { limit = 120, period = 60 }\n"
save(path, text, nl)

# CRM summary cards.
path = '.github/crm/web/index.html'
text, nl = load(path)
nav_anchor = '    <nav class="tabs" aria-label="CRM 메뉴">'
if nav_anchor not in text:
    raise SystemExit('CRM nav anchor missing')
analytics_html = '''    <h2>홈페이지 방문 통계</h2>
    <section class="stats" aria-label="홈페이지 방문 현황">
      <article><small>오늘 방문 세션</small><b id="stat-site-today-visits">-</b></article>
      <article><small>오늘 페이지 조회</small><b id="stat-site-today-pageviews">-</b></article>
      <article><small>최근 7일 방문 세션</small><b id="stat-site-7d-visits">-</b></article>
      <article><small>최근 30일 방문 세션</small><b id="stat-site-30d-visits">-</b></article>
    </section>
    <p id="site-analytics-note" class="sub">오늘부터 방문 통계를 집계합니다. 이름·전화번호·IP 주소는 방문통계 DB에 저장하지 않습니다.</p>

'''
if 'stat-site-today-visits' not in text:
    text = text.replace(nav_anchor, analytics_html + nav_anchor, 1)
save(path, text, nl)

# CRM dashboard rendering.
path = '.github/crm/web/app.js'
text, nl = load(path)
app_anchor = "    $('stat-blocked').textContent = (dash.consent_revoked + dash.consent_unknown).toLocaleString('ko-KR');\n"
if app_anchor not in text:
    raise SystemExit('CRM app stats anchor missing')
app_insert = app_anchor + """    const site = dash.site_analytics || {today:{},last7:{},last30:{},top_pages:[],top_sources:[]};
    $('stat-site-today-visits').textContent = Number(site.today?.visits||0).toLocaleString('ko-KR');
    $('stat-site-today-pageviews').textContent = Number(site.today?.pageviews||0).toLocaleString('ko-KR');
    $('stat-site-7d-visits').textContent = Number(site.last7?.visits||0).toLocaleString('ko-KR');
    $('stat-site-30d-visits').textContent = Number(site.last30?.visits||0).toLocaleString('ko-KR');
    const pageNames={'/':'홈','/rates.html':'요금 알아보기','/links.html':'블로그·SNS'};
    const sourceNames={direct:'직접 방문',internal:'사이트 내부',other:'기타'};
    const topPage=site.top_pages?.[0], topSource=site.top_sources?.[0];
    $('site-analytics-note').textContent = Number(site.last30?.pageviews||0)
      ? `최근 30일 페이지 조회 ${Number(site.last30.pageviews).toLocaleString('ko-KR')}회 · 인기 페이지 ${pageNames[topPage?.path]||topPage?.path||'-'} · 주요 유입 ${sourceNames[topSource?.source]||topSource?.source||'-'}`
      : '오늘부터 방문 통계를 집계합니다. 이름·전화번호·IP 주소는 방문통계 DB에 저장하지 않습니다.';
"""
text = text.replace(app_anchor, app_insert, 1)
save(path, text, nl)

# Public site config + small session analytics client.
Path('assets/analytics-config.js').write_text('window.WOONGBI_ANALYTICS={version:"20260924-1",naverCommonKey:"",naverHost:"woongbts.github.io",siteAnalyticsEndpoint:"https://woongbi-consent.woongbts.workers.dev/api/site-analytics"};\n', encoding='utf-8')
Path('assets/site-analytics.min.js').write_text(r'''!function(){const C=window.WOONGBI_ANALYTICS||{},E=C.siteAnalyticsEndpoint;if(!E||location.hostname!=="woongbts.github.io"||navigator.webdriver||navigator.doNotTrack==="1")return;let s="";try{s=sessionStorage.getItem("wb_site_session_v1")||"";if(!s){s=crypto.randomUUID?crypto.randomUUID():[...crypto.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,"0")).join("");sessionStorage.setItem("wb_site_session_v1",s)}}catch(e){s=crypto.randomUUID?crypto.randomUUID():[...crypto.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,"0")).join("")}function q(){let r="direct";try{if(document.referrer){const u=new URL(document.referrer);r=u.hostname===location.hostname?"internal":u.hostname.replace(/^www\./,"").toLowerCase().slice(0,80)||"other"}}catch(e){r="other"}const w=Math.max(document.documentElement.clientWidth||0,innerWidth||0),d=w<=767?"mobile":w<=1100?"tablet":"desktop";fetch(E,{method:"POST",mode:"cors",credentials:"omit",keepalive:!0,headers:{"Content-Type":"text/plain;charset=UTF-8"},body:JSON.stringify({session_id:s,path:location.pathname,source:r,device:d})}).catch(()=>{})}document.visibilityState==="prerender"?document.addEventListener("visibilitychange",function f(){if(document.visibilityState!=="prerender"){document.removeEventListener("visibilitychange",f);q()}}):q()}();\n''', encoding='utf-8')

for path in ['index.html', 'rates.html', 'links.html']:
    text, nl = load(path)
    text = text.replace('analytics-config.js?v=20260918-1', 'analytics-config.js?v=20260924-1')
    if 'site-analytics.min.js' not in text:
        marker = '<script src="/assets/conversion-tracker.min.js?v=20260918-1" defer></script>'
        script = '<script src="/assets/site-analytics.min.js?v=20260924-1" defer></script>'
        if marker in text:
            text = text.replace(marker, marker + script, 1)
        elif '</body>' in text:
            text = text.replace('</body>', script + '</body>', 1)
        else:
            raise SystemExit(f'body anchor missing: {path}')
    save(path, text, nl)

# Privacy notice: analytics is first-party, aggregate, and does not store IP in D1.
path = 'privacy.html'
text, nl = load(path)
text = text.replace('시행일: 2026년 9월 19일', '시행일: 2026년 9월 24일')
old = '접속기록, IP 주소, 브라우저·기기 정보 등 서비스 이용 과정에서 자동 생성되는 정보가 처리될 수 있습니다.'
new = '페이지 경로, 유입 도메인, 기기 구분, 무작위 방문 세션 식별값이 방문 통계 목적으로 처리될 수 있습니다. 방문 통계 DB에는 이름·전화번호·IP 주소를 저장하지 않습니다.'
if old not in text:
    raise SystemExit('privacy analytics item missing')
text = text.replace(old, new, 1)
period = '<p>광고성 정보 수신 동의 이력은 동의 또는 철회 사실을 확인하기 위해 필요한 기간 동안 보관할 수 있습니다.</p>'
if period not in text:
    raise SystemExit('privacy period anchor missing')
text = text.replace(period, period + '<p>홈페이지 방문 세션 식별값은 중복 집계를 위해 최대 3일간만 보관하며, 이후에는 일별 방문 세션 수·페이지 조회수·유입경로 등 개인을 식별하지 않는 집계 통계만 남깁니다.</p>', 1)
save(path, text, nl)
