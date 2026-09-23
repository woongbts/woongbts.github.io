const headers = {
  'cache-control':'no-store', 'referrer-policy':'no-referrer', 'x-content-type-options':'nosniff',
  'x-frame-options':'DENY', 'x-robots-tag':'noindex, nofollow',
  'content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
};
function reply(body,status=200) {return new Response(JSON.stringify(body),{status,headers:{...headers,'content-type':'application/json; charset=utf-8'}});}
const SITE_ORIGIN='https://woongbts.github.io';
function analyticsReply(body,status=200){return new Response(JSON.stringify(body),{status,headers:{...headers,'content-type':'application/json; charset=utf-8','access-control-allow-origin':SITE_ORIGIN,'vary':'Origin'}});}
export default {
  async fetch(request,env) {
    const url=new URL(request.url);
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
      // Fetch the directory URL: /index.html is canonicalized back to / by Assets.
      const path=url.pathname==='/'?'/intake':url.pathname==='/c'?'/':url.pathname;
      const asset=await env.ASSETS.fetch(new Request(new URL(path,url.origin),request));
      const safe=new Headers(asset.headers); for(const [k,v] of Object.entries(headers))safe.set(k,v);
      return new Response(asset.body,{status:asset.status,headers:safe});
    }
    return reply({ok:false,error:'페이지를 찾을 수 없습니다.'},404);
  }
};
