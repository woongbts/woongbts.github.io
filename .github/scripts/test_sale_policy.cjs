const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = {window:{}, document:{getElementById:()=>null}, Intl, Date};
vm.runInNewContext(fs.readFileSync('assets/store-sale-policy.js','utf8'), context);
const available = context.window.WoongbiSalePolicy.available;
for (const size of [256,512]) {
  const d = {name:`아이폰 17 ${size}GB(NEW)`};
  assert.equal(available(d,'2026-09-30'),false);
  assert.equal(available(d,'2026-10-01'),true);
  assert.equal(available(d,'2026-10-02'),true);
}
for (const name of ['아이폰 17e 256GB','아이폰 18 Pro 256GB','갤럭시 S26 5G 256GB','아이폰 17 256GB']) assert.equal(available({name},'2026-09-30'),true);
console.log('Sale policy boundary tests passed');
