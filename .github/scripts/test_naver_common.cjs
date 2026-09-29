const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const code = fs.readFileSync('assets/analytics-config.js','utf8');
function setup(host = 'woongbts.github.io') {
  const scripts=[],calls=[];
  const window={};
  const ctx=vm.createContext({window,location:{hostname:host},document:{createElement:()=>({dataset:{}}),head:{appendChild:s=>scripts.push(s)}}});
  vm.runInContext(code,ctx);
  return {window,ctx,scripts,calls,load(){window.wcs={inflow:d=>calls.push(['inflow',d]),trans:()=>{throw Error('Unexpected conversion');}};window.wcs_do=()=>calls.push(['pv']);scripts[0].onload();}};
}
const live=setup();
assert.equal(live.scripts.length,1);
assert.equal(live.scripts[0].src,'https://wcs.naver.net/wcslog.js');
live.load();
assert.equal(live.window.wcs_add.wa,'s_20e798684471');
assert.equal(live.window.WOONGBI_ANALYTICS.naverCommonKey,'');
assert.deepEqual(live.calls,[['inflow','woongbts.github.io'],['pv']]);
assert.equal(live.scripts[0].dataset.wbNaverCommon,'initialized');
vm.runInContext(code,live.ctx);
assert.equal(live.scripts.length,1);
assert.equal(live.calls.length,2);
assert.equal(setup('localhost').scripts.length,0);
assert.equal(setup('woongbi-crm.woongbts.workers.dev').scripts.length,0);
const failed=setup();failed.scripts[0].onerror();assert.equal(failed.scripts[0].dataset.wbNaverCommon,'load-failed');
for(const file of ['index.html','rates.html','links.html','manduk-mobile.html','privacy.html','404.html']) {
  const html=fs.readFileSync(file,'utf8');
  assert.equal((html.match(/src="\/assets\/analytics-config\.js/g)||[]).length,1,file);
}
console.log('Naver common: key/domain, single PV, duplicate guard, public-page coverage and failure handling passed');
