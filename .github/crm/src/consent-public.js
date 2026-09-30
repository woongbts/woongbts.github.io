const headers = {
  'cache-control':'no-store', 'referrer-policy':'no-referrer', 'x-content-type-options':'nosniff',
  'x-frame-options':'DENY', 'x-robots-tag':'noindex, nofollow',
  'content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
};
const SITE_ORIGIN='https://woongbts.github.io';
const ANALYTICS_PATHS=new Set(['/api/site-analytics','/api/site-conversion']);
const CONVERSION_EVENTS=new Set(['phone_click','kakao_click','booking_click','consult_click','rate_open','location_click','ai_open','ai_question','ai_phone_click','ai_kakao_click']);
const PAGE_ALIASES={'/index.html':'/','/':'/','/rates.html':'/rates.html','/links.html':'/links.html','/privacy.html':'/privacy.html','/manduk-mobile.html':'/manduk-mobile.html'};

function reply(body,status=200) {
  return new Response(JSON.stringify(body),{status,headers:{...headers,'content-type':'application/json; charset=utf-8'}});
}
function analyticsReply(body,status=200){
  return new Response(JSON.stringify(body),{status,headers:{...headers,'content-type':'application/json; charset=utf-8','access-control-allow-origin':SITE_ORIGIN,'vary':'Origin'}});
}
function kstDateKey(value=new Date()){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(value);
}
function normalizeSource(value){
  let source=String(value||'direct').trim().toLowerCase().slice(0,80);
  if(!/^(?:direct|internal|other|[a-z0-9.-]+)$/.test(source)) source='other';
  return source;
}
function normalizeDevice(value){
  return ['mobile','tablet','desktop'].includes(value)?value:'other';
}
function normalizePath(value){
  const raw=String(value||'').split('?')[0].slice(0,120);
  return PAGE_ALIASES[raw]||'';
}
async function ensureAnalyticsSchema(env){
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
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_site_analytics_seen_created ON site_analytics_seen(created_at)'),
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
  ]);
}
async function collectSiteAnalytics(env,body){
  await ensureAnalyticsSchema(env);
  const sessionId=String(body?.session_id||'').trim();
  if(!/^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(sessionId)){
    return {ok:false,status:400,error:'방문 세션 형식이 올바르지 않습니다.'};
  }
  const path=normalizePath(body?.path);
  if(!path) return {ok:false,status:400,error:'집계 대상 페이지가 아닙니다.'};
  const source=normalizeSource(body?.source),device=normalizeDevice(body?.device),day=kstDateKey(),now=new Date().toISOString();
  const seen=await env.DB.prepare('INSERT OR IGNORE INTO site_analytics_seen(day,session_id,created_at) VALUES(?,?,?)').bind(day,sessionId,now).run();
  const firstVisit=Number(seen?.meta?.changes||0)>0?1:0;
  const statements=[
    env.DB.prepare(`INSERT INTO site_analytics_daily(day,visits,pageviews) VALUES(?,?,1)
      ON CONFLICT(day) DO UPDATE SET visits=site_analytics_daily.visits+excluded.visits,pageviews=site_analytics_daily.pageviews+1`).bind(day,firstVisit),
    env.DB.prepare(`INSERT INTO site_analytics_pages(day,path,pageviews) VALUES(?,?,1)
      ON CONFLICT(day,path) DO UPDATE SET pageviews=site_analytics_pages.pageviews+1`).bind(day,path)
  ];
  if(firstVisit){
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
async function collectConversion(env,body){
  await ensureAnalyticsSchema(env);
  const event=String(body?.event||'').trim();
  if(!CONVERSION_EVENTS.has(event)) return {ok:false,status:400,error:'집계 대상 행동이 아닙니다.'};
  const path=normalizePath(body?.path);
  if(!path) return {ok:false,status:400,error:'집계 대상 페이지가 아닙니다.'};
  const source=normalizeSource(body?.source),device=normalizeDevice(body?.device),day=kstDateKey();
  await env.DB.prepare(`INSERT INTO site_conversion_daily(day,event,path,source,device,count) VALUES(?,?,?,?,?,1)
    ON CONFLICT(day,event,path,source,device) DO UPDATE SET count=site_conversion_daily.count+1`)
    .bind(day,event,path,source,device).run();
  return {ok:true};
}
async function readAnalyticsBody(request){
  const type=request.headers.get('content-type')||'';
  if(!(type.startsWith('text/plain')||type.startsWith('application/json'))) return {error:analyticsReply({ok:false,error:'요청 형식을 확인할 수 없습니다.'},415)};
  if(request.headers.get('origin')!==SITE_ORIGIN) return {error:analyticsReply({ok:false,error:'요청 출처를 확인할 수 없습니다.'},403)};
  // The public homepage and this collector are cross-site; exact Origin above is required.
  if(request.body===null) return {error:analyticsReply({ok:false,error:'요청 내용이 없습니다.'},400)};
  const raw=await request.text();
  if(raw.length>2048) return {error:analyticsReply({ok:false,error:'요청이 너무 큽니다.'},413)};
  try{return {body:JSON.parse(raw)}}catch{return {error:analyticsReply({ok:false,error:'요청 형식을 확인할 수 없습니다.'},400)}}
}

export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    if(ANALYTICS_PATHS.has(url.pathname) && request.method==='OPTIONS') {
      if(request.headers.get('origin')!==SITE_ORIGIN) return new Response(null,{status:403,headers});
      return new Response(null,{status:204,headers:{...headers,'access-control-allow-origin':SITE_ORIGIN,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type','access-control-max-age':'86400','vary':'Origin'}});
    }
    if(ANALYTICS_PATHS.has(url.pathname) && request.method==='POST') {
      try {
        if(env.ANALYTICS_LIMITER){
          const key=`${url.pathname}:${request.headers.get('CF-Connecting-IP')||'unknown'}`;
          if(!(await env.ANALYTICS_LIMITER.limit({key})).success) return analyticsReply({ok:false,error:'요청이 잠시 많습니다.'},429);
        }
        const parsed=await readAnalyticsBody(request);
        if(parsed.error) return parsed.error;
        const result=url.pathname==='/api/site-conversion'?await collectConversion(env,parsed.body):await collectSiteAnalytics(env,parsed.body);
        return analyticsReply(result,result.ok?200:result.status||400);
      } catch {
        return analyticsReply({ok:false,error:'방문 통계를 기록하지 못했습니다.'},400);
      }
    }
    if(request.method==='GET' && url.pathname==='/api/intake-form') {
      try {const data=await env.CONSENT.intakeForm();return reply(data,data.ok?200:503);}
      catch {return reply({ok:false,error:'동의 내용을 불러오지 못했습니다.'},503);}
    }
    if(request.method==='POST' && ['/api/form','/api/submit','/api/intake'].includes(url.pathname)) {
      if(request.headers.get('origin')!==url.origin || !request.headers.get('content-type')?.startsWith('application/json')) return reply({ok:false,error:'요청 출처를 확인할 수 없습니다.'},403);
      try {
        if(url.pathname==='/api/intake'){
          if(!env.INTAKE_LIMITER) return reply({ok:false,error:'접수 준비 중입니다. 잠시 후 다시 시도해 주세요.'},503);
          const key=request.headers.get('CF-Connecting-IP')||'unknown';
          if(!(await env.INTAKE_LIMITER.limit({key})).success) return reply({ok:false,error:'접수가 잠시 많습니다. 1분 후 다시 시도해 주세요.'},429);
        }
        const reader=request.body?.getReader(); if(!reader) return reply({ok:false},400);
        let size=0; const chunks=[];
        while(true) {const {done,value}=await reader.read(); if(done)break; size+=value.length; if(size>(url.pathname==='/api/intake'?131072:4096)){await reader.cancel();return reply({ok:false},413);} chunks.push(value);}
        const bytes=new Uint8Array(size); let offset=0; for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
        const body=JSON.parse(new TextDecoder().decode(bytes));
        const result=url.pathname==='/api/intake'?await env.CONSENT.intakeSubmit(body):url.pathname==='/api/form'?await env.CONSENT.load(body.token):await env.CONSENT.submit(body);
        return reply(result,result.ok?200:result.status||400);
      } catch {return reply({ok:false,error:'요청을 처리할 수 없습니다.'},400);}
    }
    if(request.method==='GET' && ['/c','/','/consent.js','/consent.css','/intake.js','/handwriting.js','/manifest.webmanifest','/icon.svg','/privacy'].includes(url.pathname)) {
      const path=url.pathname==='/'?'/intake':url.pathname==='/c'?'/':url.pathname;
      const asset=await env.ASSETS.fetch(new Request(new URL(path,url.origin),request));
      const safe=new Headers(asset.headers); for(const [k,v] of Object.entries(headers))safe.set(k,v);
      return new Response(asset.body,{status:asset.status,headers:safe});
    }
    return reply({ok:false,error:'페이지를 찾을 수 없습니다.'},404);
  }
};
