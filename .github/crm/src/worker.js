import { createIntakeHandlers } from './intake.js';
import { WorkerEntrypoint } from 'cloudflare:workers';
import { CONSENT_POLICY } from './consent-policy.js';
const encoder = new TextEncoder();
const decoder = new TextDecoder();
let jwksCache = { at: 0, keys: [] };
let schemaReadyPromise = null;

const intakeHandlers = createIntakeHandlers({encryptText,decryptText,phoneHmac,json,httpError,requireSameOrigin,readJson,normalizeName:normalizePersonName,withdrawConsent});
export default {
  async scheduled(event, env) { await ensureSchema(env); await intakeHandlers.purge(env); },
  async fetch(request, env) {
    try {
      const user = await authenticate(request, env);
      await ensureSchema(env);
      const url = new URL(request.url);
      if (url.pathname.startsWith('/api/')) {
        return await handleApi(request, env, user, url);
      }
      return securityHeaders(await env.ASSETS.fetch(request));
    } catch (error) {
      const status = Number(error?.status) || 500;
      const message = status >= 500 ? '서버 처리 중 오류가 발생했습니다.' : String(error.message || '요청을 처리할 수 없습니다.');
      if (status >= 500) console.error('CRM request failed', { status });
      return json({ ok: false, error: message }, status);
    }
  }
};

async function handleApi(request, env, user, url) {
  const method = request.method.toUpperCase();
  if (method === 'GET' && url.pathname === '/api/consent-intakes') return intakeHandlers.list(env,url);
  const intakeMatch=url.pathname.match(/^\/api\/consent-intakes\/([a-f0-9-]+)\/(review|remove|handwriting)$/i);
  if(intakeMatch && method==='GET' && intakeMatch[2]==='handwriting') return intakeHandlers.handwriting(env,intakeMatch[1]);
  if(intakeMatch && method==='POST' && intakeMatch[2]!=='handwriting') return intakeHandlers[intakeMatch[2]](request,env,user,intakeMatch[1]);
  if (method === 'GET' && url.pathname === '/api/health') {
    return json({ ok: true, service: 'woongbi-crm', storage: 'Cloudflare D1', pii_encryption: 'AES-GCM', phone_lookup: 'HMAC-SHA-256', raw_file_storage: false, sms_mode: env.SMS_MODE || 'dry_run' });
  }
  if (method === 'GET' && url.pathname === '/api/dashboard') {
    return dashboard(env);
  }
  if (method === 'GET' && url.pathname === '/api/customers') {
    return listCustomers(env, url);
  }
  if (method === 'POST' && url.pathname === '/api/import/preview') {
    return previewImport(request, env);
  }
  if (method === 'POST' && url.pathname === '/api/import') {
    return importCustomers(request, env, user);
  }
  if (method === 'POST' && url.pathname === '/api/campaigns/preview') {
    return previewCampaign(request, env);
  }

  const customerMatch = url.pathname.match(/^\/api\/customers\/([a-f0-9-]+)$/i);
  if (customerMatch && method === 'GET') return getCustomer(env, customerMatch[1]);

  if (method === 'GET' && url.pathname === '/api/consent-policy') return json({ok:true, policy:CONSENT_POLICY});
  const sessionMatch = url.pathname.match(/^\/api\/customers\/([a-f0-9-]+)\/consent-session$/i);
  if (sessionMatch && method === 'POST') return issueConsentSession(request, env, user, sessionMatch[1]);
  const historyMatch = url.pathname.match(/^\/api\/customers\/([a-f0-9-]+)\/consent-history$/i);
  if (historyMatch && method === 'GET') return consentHistory(env, historyMatch[1]);
  const withdrawMatch = url.pathname.match(/^\/api\/customers\/([a-f0-9-]+)\/consent-withdraw$/i);
  if (withdrawMatch && method === 'POST') return withdrawConsent(request, env, user, withdrawMatch[1]);
  const consentMatch = url.pathname.match(/^\/api\/customers\/([a-f0-9-]+)\/consent$/i);
  if (consentMatch && method === 'POST') return recordConsent(request, env, user, consentMatch[1]);

  const sendMatch = url.pathname.match(/^\/api\/campaigns\/([a-f0-9-]+)\/send$/i);
  if (sendMatch && method === 'POST') return sendCampaign(request, env, user, sendMatch[1]);

  throw httpError(404, '요청한 기능을 찾을 수 없습니다.');
}

async function authenticate(request, env) {
  if (env.DEV_AUTH_BYPASS === '1') {
    const devEmail = request.headers.get('X-CRM-Dev-Email');
    if (devEmail) return ensureAllowed(devEmail, env);
  }

  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) throw httpError(401, '관리자 인증이 필요합니다.');
  const payload = await verifyAccessJwt(token, env);
  const email = payload.email || payload.common_name;
  if (!email) throw httpError(403, '인증 계정 정보를 확인할 수 없습니다.');
  return ensureAllowed(email, env);
}

function ensureAllowed(email, env) {
  const allowed = String(env.ALLOWED_ADMIN_EMAILS || '')
    .split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length || !allowed.includes(String(email).toLowerCase())) {
    throw httpError(403, '허용된 관리자 계정이 아닙니다.');
  }
  return { email: String(email).toLowerCase() };
}

async function verifyAccessJwt(token, env) {
  const teamDomain = String(env.CF_ACCESS_TEAM_DOMAIN || '').replace(/\/$/, '');
  const audience = String(env.CF_ACCESS_AUD || '');
  if (!teamDomain || !audience) throw httpError(503, 'Cloudflare Access 설정이 완료되지 않았습니다.');

  const parts = token.split('.');
  if (parts.length !== 3) throw httpError(401, '인증 토큰 형식이 올바르지 않습니다.');
  const header = JSON.parse(decoder.decode(base64UrlBytes(parts[0])));
  const payload = JSON.parse(decoder.decode(base64UrlBytes(parts[1])));
  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= now) throw httpError(401, '관리자 인증이 만료되었습니다.');
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(audience)) throw httpError(401, '인증 대상이 일치하지 않습니다.');
  if (!String(payload.iss || '').startsWith(teamDomain)) throw httpError(401, '인증 발급자를 확인할 수 없습니다.');

  const keys = await getAccessJwks(teamDomain);
  const jwk = keys.find(k => k.kid === header.kid);
  if (!jwk) throw httpError(401, '인증 서명키를 찾을 수 없습니다.');
  const cryptoKey = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
  );
  const data = encoder.encode(`${parts[0]}.${parts[1]}`);
  const signature = base64UrlBytes(parts[2]);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, data);
  if (!valid) throw httpError(401, '관리자 인증 서명이 올바르지 않습니다.');
  return payload;
}

async function getAccessJwks(teamDomain) {
  if (Date.now() - jwksCache.at < 300000 && jwksCache.keys.length) return jwksCache.keys;
  const response = await fetch(`${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) throw httpError(503, 'Cloudflare Access 인증키를 불러오지 못했습니다.');
  const data = await response.json();
  jwksCache = { at: Date.now(), keys: data.keys || [] };
  return jwksCache.keys;
}

async function ensureSchema(env) {
  if (schemaReadyPromise) return schemaReadyPromise;
  schemaReadyPromise = (async () => {
    const info = await env.DB.prepare('PRAGMA table_info(customers)').all();
    const columns = new Set((info.results || []).map(row => String(row.name)));
    if (!columns.has('birth_date_enc')) {
      await env.DB.exec('ALTER TABLE customers ADD COLUMN birth_date_enc TEXT');
    }
    if (!columns.has('installment_months')) {
      await env.DB.exec('ALTER TABLE customers ADD COLUMN installment_months INTEGER CHECK (installment_months IS NULL OR installment_months BETWEEN 0 AND 60)');
    }
    if (!columns.has('rate_plan_enc')) {
      await env.DB.exec('ALTER TABLE customers ADD COLUMN rate_plan_enc TEXT');
    }
    if (!columns.has('service_type')) {
      await env.DB.exec("ALTER TABLE customers ADD COLUMN service_type TEXT CHECK (service_type IN ('wireless','sim') OR service_type IS NULL)");
    }
    await env.DB.exec('CREATE INDEX IF NOT EXISTS idx_customers_installment_months ON customers(installment_months)');
    // D1 exec() splits on newlines; keep each complete DDL statement prepared.
    await env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS customer_contracts (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      opened_on TEXT,
      carrier TEXT CHECK (carrier IN ('SKT','KT','LGU+','알뜰폰','기타') OR carrier IS NULL),
      device_model_enc TEXT,
      rate_plan_enc TEXT,
      installment_months INTEGER CHECK (installment_months IS NULL OR installment_months BETWEEN 0 AND 60),
      contract_hmac TEXT NOT NULL UNIQUE,
      source_type TEXT NOT NULL DEFAULT 'excel',
      source_ref TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
      )`),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_customer_contracts_customer ON customer_contracts(customer_id)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_customer_contracts_opened_on ON customer_contracts(opened_on)')
    ]);
    await ensureConsentSchema(env);
    await intakeHandlers.ensure(env);
    const contractInfo = await env.DB.prepare('PRAGMA table_info(customer_contracts)').all();
    const contractColumns = new Set((contractInfo.results || []).map(row => String(row.name)));
    if (!contractColumns.has('service_type')) {
      await env.DB.exec("ALTER TABLE customer_contracts ADD COLUMN service_type TEXT CHECK (service_type IN ('wireless','sim') OR service_type IS NULL)");
    }
    if (!contractColumns.has('rate_plan_enc')) {
      await env.DB.exec('ALTER TABLE customer_contracts ADD COLUMN rate_plan_enc TEXT');
    }
  })().catch(error => {
    schemaReadyPromise = null;
    throw error;
  });
  return schemaReadyPromise;
}

async function dashboard(env) {
  const now = new Date();
  const from = isoMonthsAgo(now, 30);
  const to = isoMonthsAgo(now, 22);
  const [total, due, consent] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) count FROM customers WHERE customer_status='active'").first(),
    env.DB.prepare("SELECT COUNT(*) count FROM customers WHERE customer_status='active' AND opened_on BETWEEN ? AND ?")
      .bind(from, to).first(),
    env.DB.prepare(`SELECT
      SUM(CASE WHEN latest='granted' THEN 1 ELSE 0 END) granted,
      SUM(CASE WHEN latest='revoked' THEN 1 ELSE 0 END) revoked,
      SUM(CASE WHEN latest='unknown' THEN 1 ELSE 0 END) unknown
      FROM (
        SELECT c.id, COALESCE((SELECT status FROM consents x WHERE x.customer_id=c.id AND x.purpose='ad_sms' ORDER BY captured_at DESC, created_at DESC LIMIT 1),'unknown') latest
        FROM customers c WHERE c.customer_status='active'
      )`).first()
  ]);
  return json({
    ok: true,
    total: Number(total?.count || 0),
    maturity_22_30: Number(due?.count || 0),
    consent_granted: Number(consent?.granted || 0),
    consent_revoked: Number(consent?.revoked || 0),
    consent_unknown: Number(consent?.unknown || 0),
    sms_mode: env.SMS_MODE || 'dry_run'
  });
}

function normalizePersonName(value) {
  return String(value || '').trim().replace(/\s+/g, '').toLowerCase();
}

function normalizeRatePlan(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function matchesCustomerQuery(query, name, phone) {
  const raw = String(query || '').trim();
  if (!raw) return true;
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 3) return String(phone || '').replace(/\D/g, '').includes(digits);
  return normalizePersonName(name).includes(normalizePersonName(raw));
}

async function listCustomers(env, url) {
  const clauses = ["c.customer_status='active'"];
  const binds = [];
  const carrier = url.searchParams.get('carrier');
  const consent = url.searchParams.get('consent');
  const serviceType = url.searchParams.get('service_type');
  const exactPhone = normalizePhone(url.searchParams.get('phone') || '');
  const query = String(url.searchParams.get('q') || '').trim().slice(0, 80);
  const queryDigits = query.replace(/\D/g, '');
  const queryPhone = queryDigits.length >= 10 && queryDigits.length <= 11 ? normalizePhone(query) : '';
  const installmentMonths = boundedInt(url.searchParams.get('installment_months'), 0, 60, null);
  const minMonths = boundedInt(url.searchParams.get('months_min'), 0, 120, null);
  const maxMonths = boundedInt(url.searchParams.get('months_max'), 0, 120, null);
  const limit = boundedInt(url.searchParams.get('limit'), 1, 200, 100);

  if (carrier) { clauses.push('c.carrier=?'); binds.push(normalizeCarrier(carrier)); }
  if (serviceType && ['wireless','sim'].includes(serviceType)) { clauses.push('c.service_type=?'); binds.push(serviceType); }
  if (exactPhone) { clauses.push('c.phone_hmac=?'); binds.push(await phoneHmac(exactPhone, env)); }
  else if (queryPhone) { clauses.push('c.phone_hmac=?'); binds.push(await phoneHmac(queryPhone, env)); }
  if (installmentMonths !== null) { clauses.push('c.installment_months=?'); binds.push(installmentMonths); }
  if (minMonths !== null) { clauses.push('c.opened_on<=?'); binds.push(isoMonthsAgo(new Date(), minMonths)); }
  if (maxMonths !== null) { clauses.push('c.opened_on>=?'); binds.push(isoMonthsAgo(new Date(), maxMonths)); }
  if (consent && ['granted','revoked','unknown'].includes(consent)) {
    clauses.push(`COALESCE((SELECT status FROM consents x WHERE x.customer_id=c.id AND x.purpose='ad_sms' ORDER BY captured_at DESC, created_at DESC LIMIT 1),'unknown')=?`);
    binds.push(consent);
  }

  const scanLimit = query && !queryPhone && !exactPhone ? 5000 : limit;
  const sql = `SELECT c.*,
    COALESCE((SELECT status FROM consents x WHERE x.customer_id=c.id AND x.purpose='ad_sms' ORDER BY captured_at DESC, created_at DESC LIMIT 1),'unknown') ad_sms_status
    FROM customers c WHERE ${clauses.join(' AND ')}
    ORDER BY COALESCE(c.opened_on,'0000-00-00') DESC, c.created_at DESC LIMIT ?`;
  binds.push(scanLimit);
  const result = await env.DB.prepare(sql).bind(...binds).all();
  const rows = [];
  for (const row of result.results || []) {
    const name = await decryptText(row.name_enc, env);
    const phoneValue = await decryptText(row.phone_enc, env);
    if (query && !queryPhone && !exactPhone && !matchesCustomerQuery(query, name, phoneValue)) continue;
    rows.push({
      id: row.id,
      name,
      phone_masked: maskPhone(phoneValue),
      birth_date: row.birth_date_enc ? await decryptText(row.birth_date_enc, env) : '',
      carrier: row.carrier,
      device_model: row.device_model_enc ? await decryptText(row.device_model_enc, env) : '',
      rate_plan: row.rate_plan_enc ? await decryptText(row.rate_plan_enc, env) : '',
      service_type: row.service_type || null,
      opened_on: row.opened_on,
      installment_months: row.installment_months,
      months_since_open: monthsBetween(row.opened_on, new Date()),
      ad_sms_status: row.ad_sms_status,
      updated_at: row.updated_at
    });
    if (rows.length >= limit) break;
  }
  return json({ ok: true, customers: rows, search_mode: queryPhone || exactPhone ? 'exact_phone' : query ? 'name_or_partial_phone' : 'list' });
}

async function getCustomer(env, id) {
  const row = await env.DB.prepare(`SELECT c.*,
    COALESCE((SELECT status FROM consents x WHERE x.customer_id=c.id AND x.purpose='ad_sms' ORDER BY captured_at DESC, created_at DESC LIMIT 1),'unknown') ad_sms_status
    FROM customers c WHERE c.id=? LIMIT 1`).bind(id).first();
  if (!row) throw httpError(404, '고객을 찾을 수 없습니다.');

  const name = await decryptText(row.name_enc, env);
  const phone = await decryptText(row.phone_enc, env);
  const birthDate = row.birth_date_enc ? await decryptText(row.birth_date_enc, env) : '';
  const relatedLines = [];

  if (name && birthDate) {
    const peers = await env.DB.prepare(`SELECT id, name_enc, phone_enc, birth_date_enc, carrier, device_model_enc, rate_plan_enc, service_type, opened_on, installment_months
      FROM customers WHERE customer_status='active' AND id<>?
      ORDER BY COALESCE(opened_on,'0000-00-00') DESC, created_at DESC LIMIT 5000`).bind(id).all();
    const personName = normalizePersonName(name);
    for (const peer of peers.results || []) {
      if (!peer.birth_date_enc) continue;
      const peerBirth = await decryptText(peer.birth_date_enc, env);
      if (peerBirth !== birthDate) continue;
      const peerName = await decryptText(peer.name_enc, env);
      if (normalizePersonName(peerName) !== personName) continue;
      relatedLines.push({
        id: peer.id,
        phone: await decryptText(peer.phone_enc, env),
        carrier: peer.carrier,
        device_model: peer.device_model_enc ? await decryptText(peer.device_model_enc, env) : '',
        rate_plan: peer.rate_plan_enc ? await decryptText(peer.rate_plan_enc, env) : '',
        service_type: peer.service_type || 'wireless',
        opened_on: peer.opened_on,
        installment_months: peer.installment_months
      });
    }
  }

  const contractResult = await env.DB.prepare(`SELECT id, opened_on, carrier, device_model_enc, rate_plan_enc, installment_months, service_type, created_at
    FROM customer_contracts WHERE customer_id=?
    ORDER BY COALESCE(opened_on,'0000-00-00') DESC, created_at DESC LIMIT 200`).bind(id).all();
  const contracts = [];
  for (const contract of contractResult.results || []) {
    contracts.push({
      id: contract.id,
      opened_on: contract.opened_on,
      carrier: contract.carrier,
      device_model: contract.device_model_enc ? await decryptText(contract.device_model_enc, env) : '',
      rate_plan: contract.rate_plan_enc ? await decryptText(contract.rate_plan_enc, env) : '',
      installment_months: contract.installment_months,
      service_type: contract.service_type || 'wireless',
      created_at: contract.created_at
    });
  }
  if (!contracts.length && row.opened_on) {
    contracts.push({
      id: `snapshot-${id}`,
      opened_on: row.opened_on,
      carrier: row.carrier,
      device_model: row.device_model_enc ? await decryptText(row.device_model_enc, env) : '',
      rate_plan: row.rate_plan_enc ? await decryptText(row.rate_plan_enc, env) : '',
      installment_months: row.installment_months,
      service_type: row.service_type || null,
      current_snapshot: true
    });
  }

  return json({ ok: true, customer: {
    id: row.id,
    name,
    phone,
    birth_date: birthDate,
    carrier: row.carrier,
    device_model: row.device_model_enc ? await decryptText(row.device_model_enc, env) : '',
    rate_plan: row.rate_plan_enc ? await decryptText(row.rate_plan_enc, env) : '',
    service_type: row.service_type || null,
    opened_on: row.opened_on,
    installment_months: row.installment_months,
    months_since_open: monthsBetween(row.opened_on, new Date()),
    ad_sms_status: row.ad_sms_status,
    related_lines: relatedLines,
    contracts,
    created_at: row.created_at,
    updated_at: row.updated_at
  }});
}

async function prepareImportRows(rows, env) {
  const identities = new Map();
  const conflictPhones = new Set();
  const normalized = [];
  let invalid = 0;
  let duplicate = 0;

  for (const [input_index, raw] of rows.entries()) {
    const name = String(raw.name || '').trim().slice(0, 80);
    const phone = normalizePhone(raw.phone || '');
    if (!name || phone.length < 10 || phone.length > 11) { invalid++; continue; }
    const row = {
      input_index,
      name,
      phone,
      birth_date: normalizeBirthDate(raw.birth_date),
      carrier: normalizeCarrier(raw.carrier),
      device_model: String(raw.device_model || '').trim().slice(0, 120),
      rate_plan: String(raw.rate_plan || '').trim().slice(0, 160),
      opened_on: normalizeDate(raw.opened_on),
      installment_months: normalizeInstallmentMonths(raw.installment_months),
      service_type: raw.service_type === 'sim' ? 'sim' : 'wireless',
      consent: normalizeConsent(raw.ad_sms_consent),
      consent_at: normalizeDateTime(raw.consent_at)
    };
    row.phone_hash = await phoneHmac(phone, env);
    row.contract_hash = await contractHmac(row, env);
    const identity = identities.get(row.phone_hash);
    const nameKey = normalizePersonName(name);
    if (identity) {
      if ((identity.name_key && nameKey && identity.name_key !== nameKey) ||
          (identity.birth_date && row.birth_date && identity.birth_date !== row.birth_date)) {
        conflictPhones.add(row.phone_hash);
      }
    } else {
      identities.set(row.phone_hash, { name_key: nameKey, birth_date: row.birth_date || '' });
    }
    normalized.push(row);
  }

  const byContract = new Map();
  const planConflictHashes = new Set();
  for (const row of normalized) {
    if (conflictPhones.has(row.phone_hash)) continue;
    const previous = byContract.get(row.contract_hash);
    if (previous) {
      duplicate++;
      if (previous.rate_plan && row.rate_plan && normalizeRatePlan(previous.rate_plan) !== normalizeRatePlan(row.rate_plan)) planConflictHashes.add(row.contract_hash);
      if (!previous.rate_plan && row.rate_plan) previous.rate_plan = row.rate_plan;
    } else byContract.set(row.contract_hash, row);
  }
  const review = normalized.filter(row => conflictPhones.has(row.phone_hash) || planConflictHashes.has(row.contract_hash)).map(row => ({
    input_index: row.input_index,
    reason: conflictPhones.has(row.phone_hash) ? '같은 전화번호의 명의자 정보 충돌' : '같은 계약의 요금제 정보 충돌'
  }));
  return { rows: [...byContract.values()].filter(row => !planConflictHashes.has(row.contract_hash)), invalid, duplicate, conflicts: review.length, review };

}

async function loadExistingCustomers(prepared, env) {
  const hashes = [...new Set(prepared.map(row => row.phone_hash))];
  const sources = new Map(prepared.map(row => [row.phone_hash, row]));
  const snapshotCandidates = new Map();
  const existing = new Map();
  for (let i = 0; i < hashes.length; i += 80) {
    const chunk = hashes.slice(i, i + 80);
    if (!chunk.length) continue;
    const placeholders = chunk.map(() => '?').join(',');
    const found = await env.DB.prepare(`SELECT id, phone_hmac, name_enc, birth_date_enc, rate_plan_enc, service_type, opened_on, carrier, device_model_enc, installment_months FROM customers WHERE phone_hmac IN (${placeholders})`).bind(...chunk).all();
    for (const item of found.results || []) {
      item._name = await decryptText(item.name_enc, env);
      item._birth = item.birth_date_enc ? await decryptText(item.birth_date_enc, env) : '';
      item._rate_plan = item.rate_plan_enc ? await decryptText(item.rate_plan_enc, env) : '';
      // Derive the current contract from its complete identity, not just its date.
      const source = sources.get(item.phone_hmac);
      const snapshot = { ...item, phone: source.phone, device_model: item.device_model_enc ? await decryptText(item.device_model_enc, env) : '' };
      const types = item.service_type ? [item.service_type] : ['wireless', 'sim'];
      const candidates = await Promise.all(types.map(service_type => contractHmac({ ...snapshot, service_type }, env)));
      item._snapshot_matches = [];
      for (const hash of candidates) snapshotCandidates.set(hash, item);
      existing.set(item.phone_hmac, item);
    }
  }
  const candidateHashes = [...snapshotCandidates.keys()];
  for (let i = 0; i < candidateHashes.length; i += 80) {
    const chunk = candidateHashes.slice(i, i + 80);
    const found = await env.DB.prepare(`SELECT customer_id, contract_hmac FROM customer_contracts WHERE contract_hmac IN (${chunk.map(() => '?').join(',')})`).bind(...chunk).all();
    for (const contract of found.results || []) {
      const current = snapshotCandidates.get(contract.contract_hmac);
      if (current.id === contract.customer_id) current._snapshot_matches.push(contract.contract_hmac);
    }
  }
  for (const item of existing.values()) item._snapshot_hash = item._snapshot_matches.length === 1 ? item._snapshot_matches[0] : null;
  return existing;
}

async function loadExistingContracts(prepared, env) {
  const hashes = [...new Set(prepared.map(row => row.contract_hash))];
  const existing = new Map();
  for (let i = 0; i < hashes.length; i += 80) {
    const chunk = hashes.slice(i, i + 80);
    if (!chunk.length) continue;
    const placeholders = chunk.map(() => '?').join(',');
    const found = await env.DB.prepare(`SELECT id, customer_id, contract_hmac, rate_plan_enc FROM customer_contracts WHERE contract_hmac IN (${placeholders})`).bind(...chunk).all();
    for (const item of found.results || []) {
      item._rate_plan = item.rate_plan_enc ? await decryptText(item.rate_plan_enc, env) : '';
      existing.set(item.contract_hmac, item);
    }
  }
  return existing;
}

function identityMatchesExisting(current, row) {
  if (!current) return true;
  if (current._name && normalizePersonName(current._name) !== normalizePersonName(row.name)) return false;
  if (current._birth && row.birth_date && current._birth !== row.birth_date) return false;
  return true;
}

async function previewImport(request, env) {
  const body = await readJson(request);
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) throw httpError(400, '미리 확인할 고객 행이 없습니다.');
  if (rows.length > 5000) throw httpError(400, '한 번에 최대 5,000개 계약까지 미리 확인할 수 있습니다.');

  const prepared = await prepareImportRows(rows, env);
  const existingCustomers = await loadExistingCustomers(prepared.rows, env);
  const existingContracts = await loadExistingContracts(prepared.rows, env);
  const wouldExist = new Set(existingCustomers.keys());
  let newCustomerCount = 0;
  let newContractCount = 0;
  let existingContractCount = 0;
  let planBackfillCount = 0;
  let planConflictCount = 0;
  let conflicts = prepared.conflicts;
  const review = [...prepared.review];

  for (const row of prepared.rows) {
    const current = existingCustomers.get(row.phone_hash);
    if (current && !identityMatchesExisting(current, row)) { conflicts++; review.push({ input_index: row.input_index, reason: '기존 고객의 명의자 정보와 다름' }); continue; }
    const existingContract = existingContracts.get(row.contract_hash);
    if (existingContract) {
      existingContractCount++;
      if (row.rate_plan) {
        if (!existingContract._rate_plan) planBackfillCount++;
        else if (normalizeRatePlan(existingContract._rate_plan) !== normalizeRatePlan(row.rate_plan)) { planConflictCount++; review.push({ input_index: row.input_index, reason: '기존 계약의 요금제와 다름 · 자동 덮어쓰기 제외' }); }
      }
      continue;
    }
    if (!wouldExist.has(row.phone_hash)) {
      newCustomerCount++;
      wouldExist.add(row.phone_hash);
    } else {
      newContractCount++;
    }
  }

  return json({
    ok: true,
    new_customer_count: newCustomerCount,
    new_contract_count: newContractCount,
    existing_contract_count: existingContractCount,
    invalid_count: prepared.invalid,
    duplicate_count: prepared.duplicate,
    conflicts,
    plan_backfill_count: planBackfillCount,
    plan_conflict_count: planConflictCount,
    review_rows: review,
    new_count: newCustomerCount,
    update_count: newContractCount,
    unchanged_count: existingContractCount
  });
}

async function importCustomers(request, env, user) {
  const body = await readJson(request);
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) throw httpError(400, '가져올 고객 행이 없습니다.');
  if (rows.length > 5000) throw httpError(400, '한 번에 최대 5,000개 계약까지 가져올 수 있습니다.');

  const preparedResult = await prepareImportRows(rows, env);
  const prepared = [...preparedResult.rows].sort((a, b) =>
    a.phone_hash.localeCompare(b.phone_hash) || String(a.opened_on || '').localeCompare(String(b.opened_on || ''))
  );
  if (!prepared.length) throw httpError(400, '유효한 이름/연락처 계약 행이 없습니다.');

  const existingCustomers = await loadExistingCustomers(prepared, env);
  const existingContracts = await loadExistingContracts(prepared, env);
  const now = new Date().toISOString();
  const batchId = crypto.randomUUID();
  const customerStatements = [];
  const contractStatements = [];
  const consentStatements = [];
  let newCustomers = 0;
  let newContracts = 0;
  let alreadyRegistered = 0;
  let snapshotUpdates = 0;
  let planBackfilled = 0;
  let planConflicts = 0;
  let conflicts = preparedResult.conflicts;
  let skipped = preparedResult.invalid + preparedResult.duplicate + preparedResult.conflicts;

  for (const row of prepared) {
    let current = existingCustomers.get(row.phone_hash);
    if (current && !identityMatchesExisting(current, row)) {
      conflicts++; skipped++; continue;
    }
    const existingContract = existingContracts.get(row.contract_hash);
    if (existingContract) {
      alreadyRegistered++;
      if (row.rate_plan && existingContract._rate_plan && normalizeRatePlan(existingContract._rate_plan) !== normalizeRatePlan(row.rate_plan)) {
        planConflicts++; skipped++; continue;
      }
      const statements = [];
      if (row.rate_plan && !existingContract._rate_plan) {
        const ratePlanEnc = await encryptText(row.rate_plan, env);
        statements.push(env.DB.prepare('UPDATE customer_contracts SET rate_plan_enc=?, updated_at=? WHERE id=? AND rate_plan_enc IS NULL').bind(ratePlanEnc, now, existingContract.id));
      }
      if (current && current._snapshot_hash === row.contract_hash) {
        // Read the saved contract value in the same transaction, including a concurrent backfill.
        statements.push(env.DB.prepare(`UPDATE customers SET
          rate_plan_enc=COALESCE(rate_plan_enc,(SELECT rate_plan_enc FROM customer_contracts WHERE id=?)),
          service_type=COALESCE(service_type,?), updated_at=? WHERE id=?`)
          .bind(existingContract.id, row.service_type, now, current.id));
      }
      if (statements.length) {
        const results = await env.DB.batch(statements);
        if (row.rate_plan && !existingContract._rate_plan && results[0].meta.changes) planBackfilled++;
      }
      skipped++; continue;
    }

    const wasNewCustomer = !current;
    if (!current) {
      const id = crypto.randomUUID();
      const nameEnc = await encryptText(row.name, env);
      const phoneEnc = await encryptText(row.phone, env);
      const birthEnc = row.birth_date ? await encryptText(row.birth_date, env) : null;
      const deviceEnc = row.device_model ? await encryptText(row.device_model, env) : null;
      const ratePlanEnc = row.rate_plan ? await encryptText(row.rate_plan, env) : null;
      customerStatements.push(env.DB.prepare(`INSERT INTO customers
        (id,phone_hmac,name_enc,phone_enc,birth_date_enc,carrier,device_model_enc,rate_plan_enc,service_type,opened_on,installment_months,source_type,source_ref,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(id, row.phone_hash, nameEnc, phoneEnc, birthEnc, row.carrier, deviceEnc, ratePlanEnc, row.service_type, row.opened_on, row.installment_months, 'excel', batchId, now, now));
      current = { id, phone_hmac: row.phone_hash, _name: row.name, _birth: row.birth_date || '', _rate_plan: row.rate_plan || '', service_type: row.service_type, opened_on: row.opened_on || '', _snapshot_hash: row.contract_hash };
      existingCustomers.set(row.phone_hash, current);
      newCustomers++;
    } else if (!current.opened_on || (row.opened_on && row.opened_on >= current.opened_on)) {
      const nameEnc = await encryptText(row.name, env);
      const phoneEnc = await encryptText(row.phone, env);
      const birthEnc = row.birth_date ? await encryptText(row.birth_date, env) : null;
      const deviceEnc = row.device_model ? await encryptText(row.device_model, env) : null;
      const ratePlanEnc = row.rate_plan ? await encryptText(row.rate_plan, env) : null;
      customerStatements.push(env.DB.prepare(`UPDATE customers SET
        name_enc=?, phone_enc=?, birth_date_enc=COALESCE(?,birth_date_enc), carrier=?,
        device_model_enc=?, rate_plan_enc=?, service_type=?, opened_on=?,
        installment_months=?, source_type='excel', source_ref=?, updated_at=?
        WHERE id=?`)
        .bind(nameEnc, phoneEnc, birthEnc, row.carrier, deviceEnc, ratePlanEnc, row.service_type, row.opened_on, row.installment_months, batchId, now, current.id));
      current._name = row.name;
      if (row.birth_date) current._birth = row.birth_date;
      current._rate_plan = row.rate_plan || '';
      current._snapshot_hash = row.contract_hash;
      if (row.service_type) current.service_type = row.service_type;
      if (row.opened_on) current.opened_on = row.opened_on;
      snapshotUpdates++;
    }

    const contractDeviceEnc = row.device_model ? await encryptText(row.device_model, env) : null;
    const contractRatePlanEnc = row.rate_plan ? await encryptText(row.rate_plan, env) : null;
    const contractId = crypto.randomUUID();
    contractStatements.push(env.DB.prepare(`INSERT INTO customer_contracts
      (id,customer_id,opened_on,carrier,device_model_enc,rate_plan_enc,installment_months,contract_hmac,source_type,source_ref,created_at,updated_at,service_type)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(contractId, current.id, row.opened_on, row.carrier, contractDeviceEnc, contractRatePlanEnc, row.installment_months, row.contract_hash, 'excel', batchId, now, now, row.service_type));
    existingContracts.set(row.contract_hash, { id: contractId, customer_id: current.id, contract_hmac: row.contract_hash, _rate_plan: row.rate_plan || '' });
    if (!wasNewCustomer) newContracts++;

    if (row.consent === 'granted' && row.consent_at) {
      consentStatements.push(env.DB.prepare(`INSERT INTO consents (id,customer_id,purpose,status,captured_at,capture_method,evidence_enc,created_at) VALUES (?,?,?,?,?,?,?,?)`)
        .bind(crypto.randomUUID(), current.id, 'ad_sms', 'unknown', row.consent_at, 'imported_record', await encryptText('Excel 동의 표시: 원문·목적·채널·증빙 검토 전, 동의 자동 부여 안 함', env), now));
    } else if (row.consent === 'revoked') {
      consentStatements.push(env.DB.prepare(`INSERT INTO consents (id,customer_id,purpose,status,captured_at,capture_method,evidence_enc,revoked_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
        .bind(crypto.randomUUID(), current.id, 'ad_sms', 'revoked', row.consent_at || now, 'imported_record', await encryptText(row.consent_at ? '기존 수신거부 기록을 Excel에서 가져옴' : 'Excel에 수신거부로 표시됨(원 거부일 미기재)', env), row.consent_at || now, now));
    }
  }

  for (let i = 0; i < customerStatements.length; i += 80) await env.DB.batch(customerStatements.slice(i, i + 80));
  for (let i = 0; i < contractStatements.length; i += 80) await env.DB.batch(contractStatements.slice(i, i + 80));
  for (let i = 0; i < consentStatements.length; i += 80) await env.DB.batch(consentStatements.slice(i, i + 80));

  const filenameEnc = body.filename ? await encryptText(String(body.filename).slice(0, 200), env) : null;
  await env.DB.prepare(`INSERT INTO import_batches (id,original_filename_enc,row_count,inserted_count,updated_count,skipped_count,created_at,created_by) VALUES (?,?,?,?,?,?,?,?)`)
    .bind(batchId, filenameEnc, rows.length, newCustomers, newContracts, skipped, now, user.email).run();
  await audit(env, user.email, 'customer_import', 'import_batch', batchId, {
    rows: rows.length, new_customers: newCustomers, new_contracts: newContracts,
    already_registered: alreadyRegistered, snapshot_updates: snapshotUpdates,
    plan_backfilled: planBackfilled, plan_conflicts: planConflicts,
    skipped, conflicts
  });

  return json({
    ok: true,
    batch_id: batchId,
    new_customer_count: newCustomers,
    new_contract_count: newContracts,
    existing_contract_count: alreadyRegistered,
    snapshot_update_count: snapshotUpdates,
    plan_backfill_count: planBackfilled,
    plan_conflict_count: planConflicts,
    inserted: newCustomers,
    updated: newContracts,
    skipped,
    conflicts
  });
}

async function recordConsent(request, env, user, customerId) {
  const exists = await env.DB.prepare('SELECT id FROM customers WHERE id=?').bind(customerId).first();
  if (!exists) throw httpError(404, '고객을 찾을 수 없습니다.');
  const body = await readJson(request);
  if (body.status === 'granted') throw httpError(409, '고객 직접 동의 화면을 이용해 주세요. 기존 증빙은 검토 기록으로만 보관합니다.');
  const status = ['revoked','unknown'].includes(body.status) ? body.status : null;
  const method = ['paper','qr','web','phone','imported_record','other'].includes(body.method) ? body.method : null;
  if (!status || !method) throw httpError(400, '동의 상태와 수집방법을 확인해 주세요.');
  const capturedAt = new Date().toISOString();
  const evidence = String(body.evidence || '').trim();
  if (status === 'granted' && !evidence) throw httpError(400, '동의 증빙 또는 기록 내용을 입력해 주세요.');
  const now = new Date().toISOString();
  const consentId = crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO consents (id,customer_id,purpose,status,captured_at,capture_method,evidence_enc,revoked_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .bind(consentId, customerId, 'ad_sms', status, capturedAt, method, evidence ? await encryptText(evidence, env) : null, status === 'revoked' ? capturedAt : null, now).run();
  await audit(env, user.email, 'consent_recorded', 'customer', customerId, { status, method });
  return json({ ok: true, consent_id: consentId });
}

async function previewCampaign(request, env) {
  const body = await readJson(request);
  const minMonths = boundedInt(body.months_min, 0, 120, 22);
  const maxMonths = boundedInt(body.months_max, minMonths, 120, 30);
  const from = isoMonthsAgo(new Date(), maxMonths);
  const to = isoMonthsAgo(new Date(), minMonths);
  const carrier = body.carrier ? normalizeCarrier(body.carrier) : null;
  const params = [from, to];
  let carrierSql = '';
  if (carrier) { carrierSql = ' AND c.carrier=?'; params.push(carrier); }

  const total = await env.DB.prepare(`SELECT COUNT(*) count FROM customers c WHERE c.customer_status='active' AND c.opened_on BETWEEN ? AND ?${carrierSql}`).bind(...params).first();
  const eligible = await env.DB.prepare(`SELECT COUNT(*) count FROM customers c WHERE c.customer_status='active' AND c.opened_on BETWEEN ? AND ?${carrierSql}
    AND EXISTS (SELECT 1 FROM consent_events e WHERE e.id=(SELECT id FROM consent_events WHERE customer_id=c.id ORDER BY rowid DESC LIMIT 1)
      AND json_extract(e.choices_json,'$.marketing_use')='consented' AND json_extract(e.choices_json,'$.ad_sms')='consented'
      AND e.valid_until > strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    AND COALESCE((SELECT status FROM consents x WHERE x.customer_id=c.id AND x.purpose='ad_sms' ORDER BY captured_at DESC, created_at DESC LIMIT 1),'unknown')='granted'`).bind(...params).first();
  const totalCount = Number(total?.count || 0);
  const eligibleCount = Number(eligible?.count || 0);
  return json({ ok: true, total_candidates: totalCount, eligible: eligibleCount, blocked_or_unknown: Math.max(0, totalCount - eligibleCount), sms_mode: env.SMS_MODE || 'dry_run' });
}

async function sendCampaign(request, env, user, campaignId) {
  const koreaHour = (new Date().getUTCHours() + 9) % 24;
  if (koreaHour >= 21 || koreaHour < 8) throw httpError(409, '오후 9시부터 오전 8시까지 광고 발송은 차단됩니다.');
  if ((env.SMS_MODE || 'dry_run') !== 'enabled') {
    await audit(env, user.email, 'campaign_send_blocked', 'campaign', campaignId, { reason: 'SMS_MODE not enabled' });
    throw httpError(409, '문자 실발송은 아직 잠겨 있습니다. 문자업체 연결·발신번호 등록·수신동의 정책 확인 후 활성화합니다.');
  }
  throw httpError(501, '문자 공급자 어댑터가 아직 연결되지 않았습니다.');
}

async function audit(env, actor, action, targetType, targetId, meta = {}) {
  await env.DB.prepare('INSERT INTO audit_logs (id,actor,action,target_type,target_id,meta_json,created_at) VALUES (?,?,?,?,?,?,?)')
    .bind(crypto.randomUUID(), actor, action, targetType || null, targetId || null, JSON.stringify(meta), new Date().toISOString()).run();
}

async function encryptText(value, env) {
  const key = await importAesKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(String(value)));
  return `${bytesBase64(iv)}.${bytesBase64(new Uint8Array(encrypted))}`;
}

async function decryptText(value, env) {
  if (!value) return '';
  const [ivPart, dataPart] = String(value).split('.');
  if (!ivPart || !dataPart) throw new Error('invalid encrypted value');
  const key = await importAesKey(env);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64Bytes(ivPart) }, key, base64Bytes(dataPart));
  return decoder.decode(decrypted);
}

async function importAesKey(env) {
  const raw = base64Bytes(String(env.CRM_DATA_KEY_B64 || ''));
  if (raw.byteLength !== 32) throw httpError(503, 'CRM 암호화 키가 설정되지 않았습니다.');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt','decrypt']);
}

async function hmacDigest(value, env) {
  const raw = base64Bytes(String(env.CRM_HMAC_KEY_B64 || ''));
  if (raw.byteLength !== 32) throw httpError(503, 'CRM 검색 키가 설정되지 않았습니다.');
  const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(String(value)));
  return [...new Uint8Array(signed)].map(v => v.toString(16).padStart(2,'0')).join('');
}

async function phoneHmac(phone, env) {
  return hmacDigest(phone, env);
}

async function contractHmac(row, env) {
  const device = String(row.device_model || '').trim().replace(/\s+/g, '').toLowerCase();
  const parts = [
    normalizePhone(row.phone || ''),
    row.opened_on || '',
    row.carrier || '',
    device,
    row.installment_months ?? ''
  ];
  // Preserve the legacy wireless hash so already-imported wireless contracts remain idempotent.
  const value = row.service_type === 'sim' ? ['sim', ...parts].join('|') : parts.join('|');
  return hmacDigest(`contract:${value}`, env);
}

function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('10')) digits = `0${digits}`;
  return digits;
}

function normalizeCarrier(value) {
  const text = String(value || '').trim();
  const s = text.toUpperCase().replace(/\s+/g, '');
  if (!s) return null;
  if (s.includes('알뜰') || s.includes('MVNO') || /모바일|프리텔|스노우맨|스카이라이프|모빙|머천드/.test(text)) return '알뜰폰';
  if (s.startsWith('SK') || s.includes('SKT')) return 'SKT';
  if (s.startsWith('KT') || s.includes('케이티')) return 'KT';
  if (s.startsWith('LG') || s.includes('유플')) return 'LGU+';
  return '기타';
}

function normalizeConsent(value) {
  const s = String(value ?? '').trim().toLowerCase();
  if (['y','yes','true','1','동의','수신동의','허용'].includes(s)) return 'granted';
  if (['n','no','false','0','거부','미동의','수신거부'].includes(s)) return 'revoked';
  return 'unknown';
}

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0,10);
  const s = String(value).trim().replace(/[./]/g, '-');
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  const year = Number(m[1]), month = Number(m[2]), day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(d.getTime()) || d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return d.toISOString().slice(0, 10);
}

function normalizeBirthDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0,10);
  let compact = String(value).trim().replace(/\D/g, '');
  if (/^\d{5}$/.test(compact)) compact = compact.padStart(6, '0');
  let year, month, day;
  const now = new Date();
  if (/^\d{6}$/.test(compact)) {
    const yy = Number(compact.slice(0,2));
    const pivot = now.getUTCFullYear() % 100;
    year = yy <= pivot ? 2000 + yy : 1900 + yy;
    month = Number(compact.slice(2,4));
    day = Number(compact.slice(4,6));
  } else if (/^\d{8}$/.test(compact)) {
    year = Number(compact.slice(0,4));
    month = Number(compact.slice(4,6));
    day = Number(compact.slice(6,8));
  } else {
    return null;
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(d.getTime()) || d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  if (year > now.getUTCFullYear() || year < now.getUTCFullYear() - 120) return null;
  return d.toISOString().slice(0,10);
}

function normalizeInstallmentMonths(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (/^(현금개통|일시불|완납|현금)$/i.test(text.replace(/\s+/g,''))) return 0;
  const match = text.match(/(\d{1,3})/);
  if (!match) return null;
  const months = Number.parseInt(match[1], 10);
  return Number.isFinite(months) && months >= 0 && months <= 60 ? months : null;
}

function normalizeDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    const day = normalizeDate(value);
    return day ? `${day}T00:00:00.000Z` : null;
  }
  return d.toISOString();
}

function isoMonthsAgo(date, months) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - Number(months), date.getUTCDate()));
  return d.toISOString().slice(0, 10);
}

function monthsBetween(dateString, end) {
  if (!dateString) return null;
  const start = new Date(`${dateString}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return null;
  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
  if (end.getUTCDate() < start.getUTCDate()) months--;
  return Math.max(0, months);
}

function maskPhone(phone) {
  const s = normalizePhone(phone);
  if (s.length < 7) return '***';
  return `${s.slice(0,3)}-****-${s.slice(-4)}`;
}

function boundedInt(value, min, max, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

async function readJson(request) {
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw httpError(415, 'JSON 요청만 허용됩니다.');
  try { return await request.json(); } catch { throw httpError(400, '요청 내용을 읽을 수 없습니다.'); }
}

function httpError(status, message) { const error = new Error(message); error.status = status; return error; }

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'x-frame-options': 'DENY'
  }});
}

function securityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'no-referrer');
  headers.set('x-frame-options', 'DENY');
  headers.set('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://login.microsoftonline.com https://graph.microsoft.com https://*.1drv.com https://*.live.com https://*.microsoftpersonalcontent.com; frame-src https://login.microsoftonline.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function base64UrlBytes(value) {
  let s = value.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return base64Bytes(s);
}

function base64Bytes(value) {
  if (!value) return new Uint8Array();
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesBase64(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}


const CONSENT_ORIGIN = 'https://woongbi-consent.woongbts.workers.dev';
const CONSENT_PURPOSES = ['marketing_use', 'ad_sms', 'ad_kakao', 'ad_call'];

async function ensureConsentSchema(env) {
  await env.DB.batch(CONSENT_DDL.map(sql => env.DB.prepare(sql)));
}
function requireApprovedPolicy() {
  if (!CONSENT_POLICY.approved || !Number.isInteger(CONSENT_POLICY.retentionYears) || CONSENT_POLICY.retentionYears <= 0 || CONSENT_POLICY.pending.length) {
    throw httpError(409, '동의 문구·보유기간 확인 전입니다. 현재는 미리보기만 가능합니다.');
  }
}
function consentExpiry(now, years = CONSENT_POLICY.retentionYears) {
  const date=new Date(now), month=date.getUTCMonth();
  date.setUTCFullYear(date.getUTCFullYear()+years);
  if (date.getUTCMonth()!==month) date.setUTCDate(0);
  return date.toISOString();
}
function requireSameOrigin(request) {
  if (request.headers.get('origin') !== new URL(request.url).origin ||
      !request.headers.get('content-type')?.startsWith('application/json')) throw httpError(403, '요청 출처를 확인할 수 없습니다.');
}
async function consentHash(text) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)))].map(v=>v.toString(16).padStart(2,'0')).join('');
}
async function requireCustomer(env, id) {
  const row = await env.DB.prepare("SELECT id,name_enc,phone_enc FROM customers WHERE id=? AND customer_status='active'").bind(id).first();
  if (!row) throw httpError(404, '고객을 찾을 수 없습니다.');
  return row;
}
async function issueConsentSession(request, env, user, customerId) {
  requireSameOrigin(request);
  requireApprovedPolicy();
  const body = await readJson(request);
  if (body.adult_confirmed !== true) throw httpError(400, '성인 고객 본인의 직접 선택인지 확인해 주세요. 미성년자·대리인 절차는 준비 중입니다.');
  await requireCustomer(env, customerId);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now()+10*60*1000).toISOString();
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map(v=>v.toString(16).padStart(2,'0')).join('');
  const tokenHash = await consentHash(token);
  const formJson = JSON.stringify(CONSENT_POLICY);
  const formHash = await consentHash(formJson);
  const actor = await encryptText(user.email, env);
  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO consent_forms(form_hash,version,text_json,created_at) VALUES(?,?,?,?)').bind(formHash,CONSENT_POLICY.version,formJson,now),
    env.DB.prepare('UPDATE consent_sessions SET cancelled_at=? WHERE customer_id=? AND used_event IS NULL AND cancelled_at IS NULL').bind(now,customerId),
    env.DB.prepare('INSERT INTO consent_sessions(token_hash,customer_id,form_hash,issued_by_enc,created_at,expires_at) VALUES(?,?,?,?,?,?)').bind(tokenHash,customerId,formHash,actor,now,expiresAt)
  ]);
  // Fragment is never sent in URLs, server logs or referrers.
  return json({ok:true, url:CONSENT_ORIGIN+'/c#'+token, expires_at:expiresAt});
}
async function findConsentSession(env, token) {
  requireApprovedPolicy();
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw httpError(410, '링크가 만료되었거나 사용할 수 없습니다.');
  const hash = await consentHash(token);
  const row = await env.DB.prepare(`SELECT s.*, f.text_json FROM consent_sessions s JOIN consent_forms f ON f.form_hash=s.form_hash
    JOIN customers c ON c.id=s.customer_id
    WHERE s.token_hash=? AND s.used_event IS NULL AND s.cancelled_at IS NULL AND s.expires_at>? AND c.customer_status='active'`).bind(hash,new Date().toISOString()).first();
  if (!row) throw httpError(410, '링크가 만료되었거나 사용할 수 없습니다.');
  if (row.form_hash !== await consentHash(JSON.stringify(CONSENT_POLICY))) throw httpError(410, '동의 문구가 변경되었습니다. 새 링크를 요청해 주세요.');
  return row;
}
async function loadConsentForm(env, token) {
  await ensureSchema(env);
  const session = await findConsentSession(env,token);
  const row = await requireCustomer(env,session.customer_id);
  const name = await decryptText(row.name_enc,env);
  const phone = await decryptText(row.phone_enc,env);
  return {ok:true, policy:JSON.parse(session.text_json), form_hash:session.form_hash, expires_at:session.expires_at,
    customer_label:(Array.from(name)[0] || '')+'** 고객님 · 연락처 끝번호 '+phone.slice(-4)};
}
async function submitConsentForm(env, body) {
  await ensureSchema(env);
  const session = await findConsentSession(env,body?.token);
  if (body.form_hash !== session.form_hash) throw httpError(409,'동의 문구를 다시 확인해 주세요.');
  if (!body.choices || CONSENT_PURPOSES.some(p=>typeof body.choices[p]!=='boolean')) throw httpError(400,'각 동의 항목을 확인해 주세요.');
  if (!body.choices.marketing_use && CONSENT_PURPOSES.slice(1).some(p=>body.choices[p])) throw httpError(400,'광고 채널 선택에는 개인정보 수집·이용 동의가 필요합니다.');
  const choices = Object.fromEntries(CONSENT_PURPOSES.map(p=>[p,body.choices[p]?'consented':'denied']));
  const id=crypto.randomUUID(), receipt=crypto.randomUUID(), now=new Date().toISOString();
  const validUntil = body.choices.marketing_use ? consentExpiry(now) : null;
  const statements = [
    env.DB.prepare('UPDATE consent_sessions SET used_event=? WHERE token_hash=? AND used_event IS NULL AND cancelled_at IS NULL AND expires_at>?').bind(id,session.token_hash,now),
    env.DB.prepare(`INSERT INTO consent_events(id,customer_id,form_hash,token_hash,choices_json,captured_at,capture_method,actor_enc,valid_until,receipt_id)
      SELECT ?,customer_id,form_hash,token_hash,?,?,'customer_link',issued_by_enc,?,? FROM consent_sessions WHERE token_hash=? AND used_event=?`)
      .bind(id,JSON.stringify(choices),now,validUntil,receipt,session.token_hash,id)
  ];
  for (const purpose of ['marketing_use','ad_sms']) {
    const status=body.choices[purpose]?'granted':'revoked';
    statements.push(env.DB.prepare(`INSERT INTO consents(id,customer_id,purpose,status,captured_at,capture_method,evidence_enc,revoked_at,created_at)
      SELECT ?,customer_id,?,?,?,'web',?,?,? FROM consent_sessions WHERE token_hash=? AND used_event=?`)
      .bind(crypto.randomUUID(),purpose,status,now,await encryptText(JSON.stringify({event_id:id,form_hash:session.form_hash}),env),status==='revoked'?now:null,now,session.token_hash,id));
  }
  const results=await env.DB.batch(statements);
  if (!results[0].meta.changes) throw httpError(410,'이미 등록했거나 만료된 링크입니다.');
  return {ok:true, receipt_id:receipt, captured_at:now, choices};
}
async function consentHistory(env, id) {
  await requireCustomer(env,id);
  const rows=await env.DB.prepare(`SELECT e.id,e.choices_json,e.captured_at,e.capture_method,e.valid_until,e.receipt_id,f.version,f.form_hash,f.text_json
    FROM consent_events e LEFT JOIN consent_forms f ON f.form_hash=e.form_hash WHERE customer_id=? ORDER BY e.rowid DESC LIMIT 100`).bind(id).all();
  return json({ok:true, events:rows.results.map(({choices_json,text_json,...r})=>{
    const choices=JSON.parse(choices_json);
    return {...r,choices,form:text_json?JSON.parse(text_json):null,
      first_confirmation_due:CONSENT_PURPOSES.slice(1).some(p=>choices[p]==='consented')?consentExpiry(r.captured_at,2):null};
  })});
}
async function withdrawConsent(request, env, user, id) {
  requireSameOrigin(request);
  await requireCustomer(env,id);
  const body=await readJson(request);
  if (body.confirmed !== true) throw httpError(400,'고객 철회 요청을 확인해 주세요.');
  const now=new Date().toISOString(), eventId=crypto.randomUUID();
  const choices=Object.fromEntries(CONSENT_PURPOSES.map(p=>[p,'withdrawn']));
  const statements=[
    env.DB.prepare('UPDATE consent_sessions SET cancelled_at=? WHERE customer_id=? AND used_event IS NULL').bind(now,id),
    env.DB.prepare(`INSERT INTO consent_events(id,customer_id,choices_json,captured_at,capture_method,actor_enc,receipt_id) VALUES(?,?,?,?,'staff_withdrawal',?,?)`)
      .bind(eventId,id,JSON.stringify(choices),now,await encryptText(user.email,env),crypto.randomUUID())
  ];
  for(const purpose of ['marketing_use','ad_sms']) statements.push(env.DB.prepare(`INSERT INTO consents(id,customer_id,purpose,status,captured_at,capture_method,revoked_at,created_at) VALUES(?,?,?,'revoked',?,'other',?,?)`).bind(crypto.randomUUID(),id,purpose,now,now,now));
  await env.DB.batch(statements);
  await intakeHandlers.removeForCustomer(env,id);
  return json({ok:true});
}
// Named entrypoint exposes only two token-scoped operations. No generic CRM proxy.
export class ConsentPublic extends WorkerEntrypoint {
  async intakeForm() { return consentResult(()=>intakeHandlers.form()); }
  async intakeSubmit(body) { return consentResult(async()=>{await ensureSchema(this.env);return intakeHandlers.submit(this.env,body);}); }
  async load(token) { return consentResult(()=>loadConsentForm(this.env,token)); }
  async submit(body) { return consentResult(()=>submitConsentForm(this.env,body)); }
}
async function consentResult(fn) {
  try { return await fn(); } catch(e) {
    const status=Number(e.status)||500;
    return {ok:false,status,error:status>=500?'처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.':e.message};
  }
}

const CONSENT_DDL = [
  "CREATE TABLE IF NOT EXISTS consent_forms (\n  form_hash TEXT PRIMARY KEY, version TEXT NOT NULL, text_json TEXT NOT NULL, created_at TEXT NOT NULL\n)",
  "CREATE TABLE IF NOT EXISTS consent_sessions (\n  token_hash TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,\n  form_hash TEXT NOT NULL REFERENCES consent_forms(form_hash), issued_by_enc TEXT NOT NULL,\n  created_at TEXT NOT NULL, expires_at TEXT NOT NULL, used_event TEXT, cancelled_at TEXT\n)",
  "CREATE INDEX IF NOT EXISTS idx_consent_sessions_customer ON consent_sessions(customer_id)",
  "CREATE TABLE IF NOT EXISTS consent_events (\n  id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,\n  form_hash TEXT REFERENCES consent_forms(form_hash), token_hash TEXT UNIQUE,\n  choices_json TEXT NOT NULL, captured_at TEXT NOT NULL, capture_method TEXT NOT NULL,\n  actor_enc TEXT, valid_until TEXT, receipt_id TEXT NOT NULL UNIQUE\n)",
  "CREATE INDEX IF NOT EXISTS idx_consent_events_customer ON consent_events(customer_id,captured_at)"
];
