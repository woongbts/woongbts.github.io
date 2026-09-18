const encoder = new TextEncoder();
const decoder = new TextDecoder();
let jwksCache = { at: 0, keys: [] };

export default {
  async fetch(request, env) {
    try {
      const user = await authenticate(request, env);
      const url = new URL(request.url);
      if (url.pathname.startsWith('/api/')) {
        return await handleApi(request, env, user, url);
      }
      return securityHeaders(await env.ASSETS.fetch(request));
    } catch (error) {
      const status = Number(error?.status) || 500;
      const message = status >= 500 ? '서버 처리 중 오류가 발생했습니다.' : String(error.message || '요청을 처리할 수 없습니다.');
      if (status >= 500) console.error(error);
      return json({ ok: false, error: message }, status);
    }
  }
};

async function handleApi(request, env, user, url) {
  const method = request.method.toUpperCase();
  if (method === 'GET' && url.pathname === '/api/health') {
    return json({ ok: true, service: 'woongbi-crm', sms_mode: env.SMS_MODE || 'dry_run' });
  }
  if (method === 'GET' && url.pathname === '/api/dashboard') {
    return dashboard(env);
  }
  if (method === 'GET' && url.pathname === '/api/customers') {
    return listCustomers(env, url);
  }
  if (method === 'POST' && url.pathname === '/api/import') {
    return importCustomers(request, env, user);
  }
  if (method === 'POST' && url.pathname === '/api/campaigns/preview') {
    return previewCampaign(request, env);
  }

  const customerMatch = url.pathname.match(/^\/api\/customers\/([a-f0-9-]+)$/i);
  if (customerMatch && method === 'GET') return getCustomer(env, customerMatch[1]);

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

async function listCustomers(env, url) {
  const clauses = ["c.customer_status='active'"];
  const binds = [];
  const carrier = url.searchParams.get('carrier');
  const consent = url.searchParams.get('consent');
  const phone = normalizePhone(url.searchParams.get('phone') || '');
  const minMonths = boundedInt(url.searchParams.get('months_min'), 0, 120, null);
  const maxMonths = boundedInt(url.searchParams.get('months_max'), 0, 120, null);
  const limit = boundedInt(url.searchParams.get('limit'), 1, 200, 100);

  if (carrier) { clauses.push('c.carrier=?'); binds.push(normalizeCarrier(carrier)); }
  if (phone) { clauses.push('c.phone_hmac=?'); binds.push(await phoneHmac(phone, env)); }
  if (minMonths !== null) { clauses.push('c.opened_on<=?'); binds.push(isoMonthsAgo(new Date(), minMonths)); }
  if (maxMonths !== null) { clauses.push('c.opened_on>=?'); binds.push(isoMonthsAgo(new Date(), maxMonths)); }
  if (consent && ['granted','revoked','unknown'].includes(consent)) {
    clauses.push(`COALESCE((SELECT status FROM consents x WHERE x.customer_id=c.id AND x.purpose='ad_sms' ORDER BY captured_at DESC, created_at DESC LIMIT 1),'unknown')=?`);
    binds.push(consent);
  }

  const sql = `SELECT c.*,
    COALESCE((SELECT status FROM consents x WHERE x.customer_id=c.id AND x.purpose='ad_sms' ORDER BY captured_at DESC, created_at DESC LIMIT 1),'unknown') ad_sms_status
    FROM customers c WHERE ${clauses.join(' AND ')}
    ORDER BY COALESCE(c.opened_on,'0000-00-00') DESC, c.created_at DESC LIMIT ?`;
  binds.push(limit);
  const result = await env.DB.prepare(sql).bind(...binds).all();
  const rows = [];
  for (const row of result.results || []) {
    rows.push({
      id: row.id,
      name: await decryptText(row.name_enc, env),
      phone_masked: maskPhone(await decryptText(row.phone_enc, env)),
      carrier: row.carrier,
      device_model: row.device_model_enc ? await decryptText(row.device_model_enc, env) : '',
      opened_on: row.opened_on,
      contract_months: row.contract_months,
      months_since_open: monthsBetween(row.opened_on, new Date()),
      ad_sms_status: row.ad_sms_status,
      updated_at: row.updated_at
    });
  }
  return json({ ok: true, customers: rows });
}

async function getCustomer(env, id) {
  const row = await env.DB.prepare(`SELECT c.*,
    COALESCE((SELECT status FROM consents x WHERE x.customer_id=c.id AND x.purpose='ad_sms' ORDER BY captured_at DESC, created_at DESC LIMIT 1),'unknown') ad_sms_status
    FROM customers c WHERE c.id=? LIMIT 1`).bind(id).first();
  if (!row) throw httpError(404, '고객을 찾을 수 없습니다.');
  return json({ ok: true, customer: {
    id: row.id,
    name: await decryptText(row.name_enc, env),
    phone: await decryptText(row.phone_enc, env),
    carrier: row.carrier,
    device_model: row.device_model_enc ? await decryptText(row.device_model_enc, env) : '',
    opened_on: row.opened_on,
    contract_months: row.contract_months,
    ad_sms_status: row.ad_sms_status,
    created_at: row.created_at,
    updated_at: row.updated_at
  }});
}

async function importCustomers(request, env, user) {
  const body = await readJson(request);
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) throw httpError(400, '가져올 고객 행이 없습니다.');
  if (rows.length > 5000) throw httpError(400, '한 번에 최대 5,000명까지 가져올 수 있습니다.');

  const prepared = [];
  const hashes = [];
  let skipped = 0;
  for (const raw of rows) {
    const name = String(raw.name || '').trim().slice(0, 80);
    const phone = normalizePhone(raw.phone || '');
    if (!name || phone.length < 8 || phone.length > 15) { skipped++; continue; }
    const phone_hash = await phoneHmac(phone, env);
    hashes.push(phone_hash);
    prepared.push({
      name, phone, phone_hash,
      carrier: normalizeCarrier(raw.carrier),
      device_model: String(raw.device_model || '').trim().slice(0, 120),
      opened_on: normalizeDate(raw.opened_on),
      contract_months: boundedInt(raw.contract_months, 0, 120, 24),
      consent: normalizeConsent(raw.ad_sms_consent),
      consent_at: normalizeDateTime(raw.consent_at)
    });
  }
  if (!prepared.length) throw httpError(400, '유효한 이름/연락처 행이 없습니다.');

  const existing = new Map();
  for (let i = 0; i < hashes.length; i += 80) {
    const chunk = hashes.slice(i, i + 80);
    const placeholders = chunk.map(() => '?').join(',');
    const found = await env.DB.prepare(`SELECT id, phone_hmac FROM customers WHERE phone_hmac IN (${placeholders})`).bind(...chunk).all();
    for (const item of found.results || []) existing.set(item.phone_hmac, item.id);
  }

  const now = new Date().toISOString();
  const batchId = crypto.randomUUID();
  const statements = [];
  const consentStatements = [];
  let inserted = 0, updated = 0;

  for (const row of prepared) {
    const currentId = existing.get(row.phone_hash);
    const id = currentId || crypto.randomUUID();
    const nameEnc = await encryptText(row.name, env);
    const phoneEnc = await encryptText(row.phone, env);
    const deviceEnc = row.device_model ? await encryptText(row.device_model, env) : null;
    if (currentId) {
      updated++;
      statements.push(env.DB.prepare(`UPDATE customers SET name_enc=?, phone_enc=?, carrier=?, device_model_enc=?, opened_on=COALESCE(?,opened_on), contract_months=?, source_type='excel', source_ref=?, updated_at=? WHERE id=?`)
        .bind(nameEnc, phoneEnc, row.carrier, deviceEnc, row.opened_on, row.contract_months, batchId, now, id));
    } else {
      inserted++;
      statements.push(env.DB.prepare(`INSERT INTO customers (id,phone_hmac,name_enc,phone_enc,carrier,device_model_enc,opened_on,contract_months,source_type,source_ref,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(id, row.phone_hash, nameEnc, phoneEnc, row.carrier, deviceEnc, row.opened_on, row.contract_months, 'excel', batchId, now, now));
    }
    if (row.consent === 'granted' && row.consent_at) {
      consentStatements.push(env.DB.prepare(`INSERT INTO consents (id,customer_id,purpose,status,captured_at,capture_method,evidence_enc,created_at) VALUES (?,?,?,?,?,?,?,?)`)
        .bind(crypto.randomUUID(), id, 'ad_sms', 'granted', row.consent_at, 'imported_record', await encryptText('기존 동의기록이 있는 Excel 행에서 가져옴', env), now));
    }
  }

  for (let i = 0; i < statements.length; i += 80) await env.DB.batch(statements.slice(i, i + 80));
  for (let i = 0; i < consentStatements.length; i += 80) await env.DB.batch(consentStatements.slice(i, i + 80));

  const filenameEnc = body.filename ? await encryptText(String(body.filename).slice(0, 200), env) : null;
  await env.DB.prepare(`INSERT INTO import_batches (id,original_filename_enc,row_count,inserted_count,updated_count,skipped_count,created_at,created_by) VALUES (?,?,?,?,?,?,?,?)`)
    .bind(batchId, filenameEnc, rows.length, inserted, updated, skipped, now, user.email).run();
  await audit(env, user.email, 'customer_import', 'import_batch', batchId, { rows: rows.length, inserted, updated, skipped });

  return json({ ok: true, batch_id: batchId, inserted, updated, skipped });
}

async function recordConsent(request, env, user, customerId) {
  const exists = await env.DB.prepare('SELECT id FROM customers WHERE id=?').bind(customerId).first();
  if (!exists) throw httpError(404, '고객을 찾을 수 없습니다.');
  const body = await readJson(request);
  const status = ['granted','revoked','unknown'].includes(body.status) ? body.status : null;
  const method = ['paper','qr','web','phone','imported_record','other'].includes(body.method) ? body.method : null;
  if (!status || !method) throw httpError(400, '동의 상태와 수집방법을 확인해 주세요.');
  const capturedAt = normalizeDateTime(body.captured_at) || new Date().toISOString();
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
    AND COALESCE((SELECT status FROM consents x WHERE x.customer_id=c.id AND x.purpose='ad_sms' ORDER BY captured_at DESC, created_at DESC LIMIT 1),'unknown')='granted'`).bind(...params).first();
  const totalCount = Number(total?.count || 0);
  const eligibleCount = Number(eligible?.count || 0);
  return json({ ok: true, total_candidates: totalCount, eligible: eligibleCount, blocked_or_unknown: Math.max(0, totalCount - eligibleCount), sms_mode: env.SMS_MODE || 'dry_run' });
}

async function sendCampaign(request, env, user, campaignId) {
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

async function phoneHmac(phone, env) {
  const raw = base64Bytes(String(env.CRM_HMAC_KEY_B64 || ''));
  if (raw.byteLength !== 32) throw httpError(503, 'CRM 검색 키가 설정되지 않았습니다.');
  const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(phone));
  return [...new Uint8Array(signed)].map(v => v.toString(16).padStart(2,'0')).join('');
}

function normalizePhone(value) { return String(value || '').replace(/\D/g, ''); }
function normalizeCarrier(value) {
  const s = String(value || '').toUpperCase().replace(/\s+/g, '');
  if (s.includes('SK')) return 'SKT';
  if (s === 'KT' || s.includes('케이티')) return 'KT';
  if (s.includes('LG') || s.includes('유플')) return 'LGU+';
  if (s.includes('알뜰') || s.includes('MVNO')) return '알뜰폰';
  return s ? '기타' : null;
}
function normalizeConsent(value) {
  const s = String(value ?? '').trim().toLowerCase();
  if (['y','yes','true','1','동의','수신동의','허용'].includes(s)) return 'granted';
  if (['n','no','false','0','거부','미동의','수신거부'].includes(s)) return 'revoked';
  return 'unknown';
}
function normalizeDate(value) {
  if (!value) return null;
  const s = String(value).trim().replace(/[./]/g, '-');
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
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
  headers.set('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
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
