import assert from 'node:assert/strict';
import collector from '../src/consent-public.js';
const allowed='https://woongbts.github.io';
for (const path of ['/api/site-analytics','/api/site-conversion']) {
  let databaseCalls=0;
  const env={DB:{prepare(){return{};},async batch(){databaseCalls++;return[];}}};
  const request=(origin,site='cross-site')=>new Request('https://woongbi-consent.woongbts.workers.dev'+path,{method:'POST',headers:{origin,'sec-fetch-site':site,'content-type':'text/plain'},body:'{}'});
  const validOrigin=await collector.fetch(request(allowed),env);
  assert.equal(validOrigin.status,400,'Correct cross-site origin must reach payload validation');
  assert.equal(databaseCalls,1);
  for (const origin of ['https://evil.example','https://woongbts.github.io.evil.example','null','']) {
    databaseCalls=0;
    assert.equal((await collector.fetch(request(origin),env)).status,403);
    assert.equal(databaseCalls,0,'Wrong origin must be rejected before database access');
  }
}
console.log('Analytics origin: homepage cross-site requests accepted; foreign/missing origins rejected');
