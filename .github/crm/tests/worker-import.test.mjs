import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { dedupeImportRows } from '../web/import-utils.js';

// All records and keys are generated test fixtures in an ephemeral local D1 database.
const script = (await build({ entryPoints:[fileURLToPath(new URL('../src/worker.js',import.meta.url))],bundle:true,write:false,format:'esm',external:['cloudflare:*']})).outputFiles[0].text;
const schema = await readFile(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8');
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true, script, compatibilityDate: '2026-09-01', d1Databases: ['DB'],
  bindings: { DEV_AUTH_BYPASS: '1', ALLOWED_ADMIN_EMAILS: 'admin@example.invalid', SMS_MODE: 'dry_run',
    CRM_DATA_KEY_B64: Buffer.alloc(32, 7).toString('base64'), CRM_HMAC_KEY_B64: Buffer.alloc(32, 9).toString('base64') }
}));
const headers = { 'X-CRM-Dev-Email': 'admin@example.invalid', 'Content-Type': 'application/json' };
async function request(path, rows) {
  const response = await mf.dispatchFetch(`https://crm.test/api/${path}`, rows ? { method: 'POST', headers, body: JSON.stringify({ rows }) } : { headers });
  assert.equal(response.status, 200, `${path}: ${await response.clone().text()}`);
  return response.json();
}
const wireless = { name: '합성테스트', phone: ['010','0000','0001'].join(''), birth_date: '1980-01-01', carrier: 'SKT', opened_on: '2024-01-01', device_model: 'TEST A', installment_months: 24, service_type: 'wireless', rate_plan: '테스트 요금제 A' };
const sim = { ...wireless, phone: ['010','0000','0002'].join(''), device_model: '', installment_months: null, service_type: 'sim', rate_plan: '테스트 유심 요금제' };
try {
  const db = await mf.getD1Database('DB');
  for (const sql of schema.split(';').map(s => s.trim()).filter(Boolean)) await db.prepare(sql).run();
  assert.equal((await mf.dispatchFetch('https://crm.test/api/customers')).status, 401);
  let result = await request('import', [wireless, sim]);
  assert.equal(result.new_customer_count, 2);
  const before = await db.prepare('SELECT id, contract_hmac, rate_plan_enc FROM customer_contracts ORDER BY id').all();
  for (const row of before.results) assert.ok(row.rate_plan_enc && !row.rate_plan_enc.includes('테스트'));
  assert.equal((await request('customers?service_type=wireless')).customers.length, 1);
  assert.equal((await request('customers?service_type=sim')).customers.length, 1);
  const all = (await request('customers')).customers;
  assert.deepEqual(all.map(c => c.rate_plan).sort(), [wireless.rate_plan, sim.rate_plan].sort());
  const wirelessId = all.find(c => c.service_type === 'wireless').id;
  result = await request('import', [wireless, sim]);
  assert.equal(result.new_customer_count, 0);
  assert.equal(result.new_contract_count, 0);
  assert.equal(result.plan_backfill_count, 0);

  // Simulate legacy contracts with blank plans and customer types.
  await db.prepare('UPDATE customer_contracts SET rate_plan_enc=NULL').run();
  await db.prepare('UPDATE customers SET rate_plan_enc=NULL, service_type=NULL').run();
  assert.equal((await request('import/preview', [wireless, sim])).plan_backfill_count, 2);
  result = await request('import', [wireless, sim]);
  assert.equal(result.plan_backfill_count, 2);
  const after = await db.prepare('SELECT id, contract_hmac FROM customer_contracts ORDER BY id').all();
  assert.deepEqual(after.results, before.results.map(({id,contract_hmac}) => ({id,contract_hmac})));
  assert.equal((await request(`customers/${wirelessId}`)).customer.rate_plan, wireless.rate_plan);
  assert.equal((await request('customers?service_type=sim')).customers.length, 1);

  const differentPlan = { ...wireless, rate_plan: '다른 요금제' };
  const preview = await request('import/preview', [differentPlan]);
  assert.equal(preview.plan_conflict_count, 1);
  assert.equal(preview.review_rows[0].input_index, 0);
  assert.equal((await request('import', [differentPlan])).plan_conflict_count, 1);
  assert.equal((await request(`customers/${wirelessId}`)).customer.rate_plan, wireless.rate_plan);

  // A newer contract without a plan must not inherit the old plan.
  const newer = { ...wireless, opened_on: '2025-01-01', device_model: 'TEST B', rate_plan: '' };
  await request('import', [newer]);
  let detail = (await request(`customers/${wirelessId}`)).customer;
  assert.equal(detail.rate_plan, '');
  assert.equal(detail.contracts.length, 2);
  await request('import', [wireless]);
  assert.equal((await request(`customers/${wirelessId}`)).customer.rate_plan, '');
  await request('import', [{ ...newer, rate_plan: '현재 요금제' }]);
  assert.equal((await request(`customers/${wirelessId}`)).customer.rate_plan, '현재 요금제');

  // Two contracts on one date: backfilling the other device cannot change the snapshot.
  const sameDay = { ...newer, device_model: 'TEST C', rate_plan: '' };
  await request('import', [sameDay]);
  await db.prepare('UPDATE customer_contracts SET rate_plan_enc=NULL WHERE customer_id=?').bind(wirelessId).run();
  await request('import', [{ ...newer, rate_plan: '다른 기기 요금제' }]);
  detail = (await request(`customers/${wirelessId}`)).customer;
  assert.equal(detail.device_model, 'TEST C');
  assert.equal(detail.rate_plan, '');

  // Frontend and backend both merge blank duplicate values and reject disagreements.
  const pair = [{ ...sameDay, rate_plan: '' }, { ...sameDay, rate_plan: '보충 요금제' }];
  assert.equal(dedupeImportRows(pair).rows[0].rate_plan, '보충 요금제');
  assert.equal((await request('import', pair)).plan_backfill_count, 1);
  assert.equal(dedupeImportRows([wireless, differentPlan]).conflicts.length, 2);
  const conflictingPreview = await request('import/preview', [wireless, differentPlan]);
  assert.equal(conflictingPreview.conflicts, 2);
  assert.equal(conflictingPreview.review_rows.length, 2);
  assert.equal((await request('health')).sms_mode, 'dry_run');
  console.log('Encrypted plan import, backfill, conflict, history and type-filter checks passed');
} finally {
  await mf.dispose();
}
