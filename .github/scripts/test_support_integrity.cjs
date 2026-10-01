const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const calculator = fs.readFileSync('src/rates.js','utf8');
const bridge = fs.readFileSync('assets/quote-api-bridge.min.js','utf8');

for (const marker of [
  'function wbValidPublicSupport(',
  'function N(',
  'function R(',
  'function W(',
  'function T(',
  'const n=.059/12',
  '28600),label:"생계·의료급여"',
  '45100)',
  '23650',
]) assert.equal(calculator.includes(marker), false, `public quote formula returned: ${marker}`);

assert.ok(calculator.includes('window.WoongbiQuoteApi?.getCurrent'), 'direct calculator must read server quote cache');
assert.ok(calculator.includes('window.WoongbiQuoteApi?.sync'), 'direct calculator must trigger server quote sync');
assert.ok(calculator.includes('l.quotePair'), 'device comparison must request server quote pairs');
assert.ok(bridge.includes("https://woongbi-quote-api.woongbts.workers.dev/quote/mobile"), 'production quote endpoint missing');
assert.ok(bridge.includes('window.WoongbiQuoteApi='), 'server quote state manager missing');
assert.ok(bridge.includes('fetchQuote'), 'arbitrary server quote fetch missing');
assert.ok(bridge.includes('quotePair'), 'server quote pair API missing');
assert.ok(bridge.includes("dataset.quoteApi='unavailable'"), 'safe unavailable state missing');
assert.ok(bridge.includes('현재 자동 계산을 불러오지 못했습니다'), 'customer-safe failure message missing');

const ctx={window:{},document:{getElementById:()=>null}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('assets/plan-eligibility.js','utf8'),ctx);
assert.equal(ctx.window.WoongbiPlanEligibility.allowed({name:'데이터플랜80GB(복지)',age_limit:'ALL'},'premium'),false);
assert.equal(ctx.window.WoongbiPlanEligibility.allowed({name:'데이터플랜MAX',age_limit:'ALL'},'premium'),true);

console.log('Server-only quote integrity: public formulas absent, server cache/fetch wiring present, safe failure and shared audience rules passed.');
