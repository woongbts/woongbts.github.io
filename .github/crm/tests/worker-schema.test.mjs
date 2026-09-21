import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const script = await readFile(new URL('../src/worker.js', import.meta.url), 'utf8');
const initialSchema = await readFile(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8');
const profileSchema = await readFile(new URL('../migrations/0002_customer_profile.sql', import.meta.url), 'utf8');
const contractSchema = await readFile(new URL('../migrations/0003_customer_contracts.sql', import.meta.url), 'utf8');

// Exercise the real D1 binding, including its exec() newline behavior.
// Databases are ephemeral and contain no customer records or production secrets.
for (const stage of [0, 1, 2]) {
  const hasProfile = stage >= 1;
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script,
    compatibilityDate: '2026-09-01',
    d1Databases: ['DB'],
    bindings: { DEV_AUTH_BYPASS: '1', ALLOWED_ADMIN_EMAILS: 'admin@example.invalid', SMS_MODE: 'dry_run' },
    serviceBindings: { ASSETS: () => new Response('<!doctype html><title>CRM test</title>', { headers: { 'Content-Type': 'text/html' } }) }
  }));
  try {
    const db = await mf.getD1Database('DB');
    for (const sql of [initialSchema, ...(hasProfile ? [profileSchema] : []), ...(stage === 2 ? [contractSchema] : [])]) {
      for (const statement of sql.split(';').map(value => value.trim()).filter(Boolean)) {
        await db.prepare(statement).run();
      }
    }
    const unauthenticated = await mf.dispatchFetch('https://crm.test/api/health');
    assert.equal(unauthenticated.status, 401);
    const headers = { 'X-CRM-Dev-Email': 'admin@example.invalid' };
    for (let pass = 0; pass < 2; pass++) {
      for (const path of ['/', '/api/health', '/api/dashboard', '/api/customers']) {
        const response = await mf.dispatchFetch(`https://crm.test${path}`, { headers });
        assert.equal(response.status, 200, `profile=${hasProfile} pass=${pass} ${path}: ${await response.text()}`);
      }
    }
    const customers = await db.prepare('PRAGMA table_info(customers)').all();
    assert.ok(customers.results.some(column => column.name === 'rate_plan_enc'));
    assert.ok(customers.results.some(column => column.name === 'service_type'));
    const contracts = await db.prepare('PRAGMA table_info(customer_contracts)').all();
    assert.ok(contracts.results.some(column => column.name === 'contract_hmac'));
    assert.ok(contracts.results.some(column => column.name === 'service_type'));
    assert.ok(contracts.results.some(column => column.name === 'rate_plan_enc'));
    const indexes = await db.prepare("SELECT name FROM sqlite_schema WHERE type='index' AND tbl_name='customer_contracts'").all();
    assert.ok(indexes.results.some(index => index.name === 'idx_customer_contracts_customer'));
    assert.ok(indexes.results.some(index => index.name === 'idx_customer_contracts_opened_on'));
    console.log(`Worker startup and D1 schema passed (existing profile: ${hasProfile})`);
  } finally {
    await mf.dispose();
  }
}
