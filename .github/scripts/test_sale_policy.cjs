const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = {window:{}, document:{getElementById:()=>null}, Intl, Date};
const source = fs.readFileSync('assets/store-sale-policy.js','utf8');
vm.runInNewContext(source, context);
const available = context.window.WoongbiSalePolicy.available;
for (const name of ['아이폰 17 256GB(NEW)','아이폰 17 512GB(NEW)','아이폰 17e 256GB','아이폰 18 Pro 256GB','갤럭시 S26 5G 256GB']) {
  assert.equal(available({name},'2026-09-30'), true);
  assert.equal(available({name},'2026-10-01'), true);
}
assert.equal(source.includes('2026-10-01'), false);
assert.equal(source.includes('1,287,000'), false);
assert.equal(source.includes('1,584,000'), false);
assert.equal(source.includes('1,452,000'), false);
assert.equal(source.includes('1,760,000'), false);
console.log('Expired sale-transition details are absent and compatibility policy stays open');
