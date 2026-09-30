const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const code = fs.readFileSync('assets/site-analytics.min.js', 'utf8');
function source(search, referrer, previous) {
  const saved = new Map(previous ? [['wb_site_source_v1', previous]] : []);
  let sent;
  const window = {WOONGBI_ANALYTICS:{siteAnalyticsEndpoint:'https://example.test/events'}};
  vm.runInNewContext(code, {window,location:{hostname:'woongbts.github.io',pathname:'/',search},navigator:{},URL,URLSearchParams,crypto:{randomUUID:()=> 'test-session'},sessionStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},document:{referrer,documentElement:{clientWidth:390},visibilityState:'visible'},innerWidth:390,fetch:(_url,args)=>{sent=JSON.parse(args.body);return Promise.resolve();}});
  return {sent,saved};
}
for (const channel of ['naver-place','naver-blog','daangn','kakao-channel','kakao-map','google-business','threads','instagram']) {
  const result=source('?utm_source='+channel, '', 'direct');
  assert.equal(result.sent.source,channel);
  assert.equal(source('', 'https://woongbts.github.io/', result.saved.get('wb_site_source_v1')).sent.source,channel);
}
assert.equal(source('?utm_source=private-arbitrary-value','https://search.naver.com/',null).sent.source,'search.naver.com');
assert.equal(source('', '', null).sent.source,'direct');
console.log('Platform source tagging and session continuity passed.');
