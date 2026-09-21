from pathlib import Path

worker = Path('.github/crm/src/worker.js')
s = worker.read_text(encoding='utf-8')

anchor = "const decoder = new TextDecoder();\n"
add = "const decoder = new TextDecoder();\nconst TABLET_CONSENT_FORM_VERSION = 'WB-CONSENT-1.0';\nconst TABLET_CONSENT_EVIDENCE = '웅비통신 고객관리 선택동의|목적:약정·요금할인 종료 안내,통신비·결합할인 점검,기기변경 및 매장 혜택·프로모션 안내|항목:성명,휴대전화번호,가입 통신사,개통일 및 최근 거래일|보유:동의일로부터 3년 또는 동의 철회 시까지 중 먼저 도래하는 때|거부권:동의하지 않아도 개통·A/S·기본상담 이용 제한 없음|광고채널:SMS/MMS';\n"
assert anchor in s and 'TABLET_CONSENT_FORM_VERSION' not in s
s = s.replace(anchor, add, 1)

route_anchor = "  const consentMatch = url.pathname.match(/^\\/api\\/customers\\/([a-f0-9-]+)\\/consent$/i);\n  if (consentMatch && method === 'POST') return recordConsent(request, env, user, consentMatch[1]);\n"
route_add = route_anchor + "\n  const tabletConsentMatch = url.pathname.match(/^\\/api\\/customers\\/([a-f0-9-]+)\\/tablet-consent$/i);\n  if (tabletConsentMatch && method === 'POST') return recordTabletConsent(request, env, user, tabletConsentMatch[1]);\n"
assert route_anchor in s
s = s.replace(route_anchor, route_add, 1)

select_old = "    COALESCE((SELECT status FROM consents x WHERE x.customer_id=c.id AND x.purpose='ad_sms' ORDER BY captured_at DESC, created_at DESC LIMIT 1),'unknown') ad_sms_status\n    FROM customers c WHERE c.id=? LIMIT 1`)"
select_new = "    COALESCE((SELECT status FROM consents x WHERE x.customer_id=c.id AND x.purpose='ad_sms' ORDER BY captured_at DESC, created_at DESC LIMIT 1),'unknown') ad_sms_status,\n    COALESCE((SELECT status FROM consents x WHERE x.customer_id=c.id AND x.purpose='marketing_use' ORDER BY captured_at DESC, created_at DESC LIMIT 1),'unknown') marketing_use_status\n    FROM customers c WHERE c.id=? LIMIT 1`)"
assert select_old in s
s = s.replace(select_old, select_new, 1)

obj_old = "    ad_sms_status: row.ad_sms_status,\n    related_lines: relatedLines,"
obj_new = "    ad_sms_status: row.ad_sms_status,\n    marketing_use_status: row.marketing_use_status,\n    related_lines: relatedLines,"
assert obj_old in s
s = s.replace(obj_old, obj_new, 1)

fn_anchor = "async function previewCampaign(request, env) {"
new_fn = r'''async function recordTabletConsent(request, env, user, customerId) {
  const exists = await env.DB.prepare('SELECT id FROM customers WHERE id=?').bind(customerId).first();
  if (!exists) throw httpError(404, '고객을 찾을 수 없습니다.');
  const body = await readJson(request);
  const marketingUse = body.marketing_use === true;
  const adSms = body.ad_sms === true;
  if (adSms && !marketingUse) throw httpError(400, '문자 수신동의는 고객관리·마케팅 개인정보 이용 동의와 함께 선택해 주세요.');
  const capturedAt = normalizeDateTime(body.captured_at) || new Date().toISOString();
  const now = new Date().toISOString();
  const marketingStatus = marketingUse ? 'granted' : 'revoked';
  const smsStatus = adSms ? 'granted' : 'revoked';
  const evidence = `${TABLET_CONSENT_EVIDENCE}|form_version:${TABLET_CONSENT_FORM_VERSION}|marketing_use:${marketingStatus}|ad_sms:${smsStatus}|customer_direct_action:true`;
  const evidenceEnc = await encryptText(evidence, env);
  const statements = [
    env.DB.prepare(`INSERT INTO consents (id,customer_id,purpose,status,captured_at,capture_method,evidence_enc,revoked_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
      .bind(crypto.randomUUID(), customerId, 'marketing_use', marketingStatus, capturedAt, 'web', evidenceEnc, marketingStatus === 'revoked' ? capturedAt : null, now),
    env.DB.prepare(`INSERT INTO consents (id,customer_id,purpose,status,captured_at,capture_method,evidence_enc,revoked_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
      .bind(crypto.randomUUID(), customerId, 'ad_sms', smsStatus, capturedAt, 'web', evidenceEnc, smsStatus === 'revoked' ? capturedAt : null, now)
  ];
  await env.DB.batch(statements);
  await audit(env, user.email, 'tablet_consent_recorded', 'customer', customerId, {
    marketing_use: marketingStatus,
    ad_sms: smsStatus,
    form_version: TABLET_CONSENT_FORM_VERSION,
    customer_direct_action: true
  });
  return json({ ok: true, marketing_use_status: marketingStatus, ad_sms_status: smsStatus, form_version: TABLET_CONSENT_FORM_VERSION });
}

'''
assert fn_anchor in s and 'async function recordTabletConsent' not in s
s = s.replace(fn_anchor, new_fn + fn_anchor, 1)
worker.write_text(s, encoding='utf-8')

html = Path('.github/crm/web/index.html')
h = html.read_text(encoding='utf-8')
detail_anchor = '      <dl id="detail-list"></dl>\n'
detail_add = detail_anchor + '''      <div class="tablet-consent-entry">
        <button id="open-tablet-consent" type="button" class="primary">태블릿 동의받기</button>
        <small>통신사 개통서류와 별개인 웅비통신 선택 동의 화면을 고객에게 직접 보여줍니다.</small>
      </div>
'''
assert detail_anchor in h and 'id="open-tablet-consent"' not in h
h = h.replace(detail_anchor, detail_add, 1)

dialog_anchor = '  <script type="module" src="/app.js"></script>\n'
tablet_dialog = '''  <dialog id="tablet-consent-dialog" class="tablet-consent-dialog">
    <div class="tablet-consent-card">
      <div class="tablet-consent-brand"><strong>웅비통신 덕천만덕점</strong><span>고객관리 알림 선택 신청</span></div>
      <p class="tablet-consent-complete">통신사 개통 서류 작성은 모두 완료되었습니다.<br>아래 내용은 <b>웅비통신 덕천만덕점의 선택 서비스</b>이며, 동의하지 않으셔도 개통·A/S·기본 상담 이용에는 제한이 없습니다.</p>
      <p id="tablet-consent-customer" class="tablet-consent-customer"></p>

      <label class="tablet-consent-option">
        <span><input id="tablet-marketing-use" type="checkbox"> <b>[선택] 고객관리·마케팅 목적 개인정보 수집·이용 동의</b></span>
        <small><b>목적</b> 약정·요금할인 종료 시점 안내, 통신비·결합할인 점검, 기기변경 및 매장 혜택·프로모션 안내<br><b>항목</b> 성명, 휴대전화번호, 가입 통신사, 개통일 및 최근 거래일<br><b>보유·이용</b> 동의일로부터 3년 또는 동의 철회 시까지 중 먼저 도래하는 때<br><b>거부권</b> 동의하지 않아도 개통·A/S·기본 상담 이용에는 제한이 없습니다.</small>
      </label>

      <label class="tablet-consent-option">
        <span><input id="tablet-ad-sms" type="checkbox" disabled> <b>[선택] 광고성 정보 문자(SMS/MMS) 수신 동의</b></span>
        <small>웅비통신의 통신상품, 요금·결합 혜택, 기기변경, 매장 행사 및 프로모션 정보를 문자로 받아보실 수 있습니다. 언제든 수신동의를 철회할 수 있습니다.</small>
      </label>

      <p id="tablet-consent-result" class="tablet-consent-result" aria-live="polite"></p>
      <div class="tablet-consent-actions">
        <button id="tablet-consent-submit" type="button" class="primary">선택 내용 등록</button>
        <button id="tablet-consent-decline" type="button" class="ghost">동의하지 않고 종료</button>
      </div>
      <small class="tablet-consent-version">동의서 버전 WB-CONSENT-1.0</small>
    </div>
  </dialog>

'''
assert dialog_anchor in h and 'id="tablet-consent-dialog"' not in h
h = h.replace(dialog_anchor, tablet_dialog + dialog_anchor, 1)
html.write_text(h, encoding='utf-8')

app = Path('.github/crm/web/app.js')
a = app.read_text(encoding='utf-8')
state_anchor = "let selectedCustomerId = null;\n"
assert state_anchor in a
a = a.replace(state_anchor, state_anchor + "let selectedCustomerSnapshot = null;\n", 1)

event_anchor = "$('save-consent').addEventListener('click', saveConsent);\n"
event_add = event_anchor + "$('open-tablet-consent').addEventListener('click', openTabletConsent);\n$('tablet-marketing-use').addEventListener('change', syncTabletConsentControls);\n$('tablet-consent-submit').addEventListener('click', () => submitTabletConsent(false));\n$('tablet-consent-decline').addEventListener('click', () => submitTabletConsent(true));\n"
assert event_anchor in a
a = a.replace(event_anchor, event_add, 1)

show_anchor = "    selectedCustomerId = id;\n    $('detail-name').textContent = c.name;\n"
show_new = "    selectedCustomerId = id;\n    selectedCustomerSnapshot = c;\n    $('detail-name').textContent = c.name;\n"
assert show_anchor in a
a = a.replace(show_anchor, show_new, 1)

detail_old = "<dt>문자동의</dt><dd>${consentLabel(c.ad_sms_status)}</dd>`;"
detail_new = "<dt>마케팅정보 이용</dt><dd>${consentLabel(c.marketing_use_status)}</dd><dt>문자동의</dt><dd>${consentLabel(c.ad_sms_status)}</dd>`;"
assert detail_old in a
a = a.replace(detail_old, detail_new, 1)

fn_anchor_app = "async function saveConsent() {\n"
new_app_fn = r'''function openTabletConsent() {
  if (!selectedCustomerId || !selectedCustomerSnapshot) return;
  const digits = String(selectedCustomerSnapshot.phone || '').replace(/\D/g, '');
  $('tablet-consent-customer').textContent = `${selectedCustomerSnapshot.name} 고객님 · 휴대전화 끝번호 ${digits.slice(-4) || '----'}`;
  $('tablet-marketing-use').checked = false;
  $('tablet-ad-sms').checked = false;
  $('tablet-ad-sms').disabled = true;
  $('tablet-consent-result').textContent = '';
  $('customer-dialog').close();
  $('tablet-consent-dialog').showModal();
}

function syncTabletConsentControls() {
  const enabled = $('tablet-marketing-use').checked;
  $('tablet-ad-sms').disabled = !enabled;
  if (!enabled) $('tablet-ad-sms').checked = false;
}

async function submitTabletConsent(declineAll=false) {
  if (!selectedCustomerId) return;
  const marketingUse = declineAll ? false : $('tablet-marketing-use').checked;
  const adSms = declineAll ? false : $('tablet-ad-sms').checked;
  const result = $('tablet-consent-result');
  result.textContent = '등록 중...';
  try {
    const data = await api(`/api/customers/${selectedCustomerId}/tablet-consent`, {
      method:'POST',
      body:JSON.stringify({ marketing_use: marketingUse, ad_sms: adSms, captured_at: new Date().toISOString() })
    });
    result.textContent = declineAll ? '동의 없이 종료되었습니다.' : (data.ad_sms_status === 'granted' ? '고객관리 및 문자 수신동의가 등록되었습니다.' : '선택하신 고객관리 동의 내용이 등록되었습니다.');
    setTimeout(async () => {
      $('tablet-consent-dialog').close();
      await boot();
      if (selectedCustomerId) await showCustomer(selectedCustomerId);
    }, 700);
  } catch (error) {
    result.textContent = '';
    showError(error);
  }
}

'''
assert fn_anchor_app in a and 'function openTabletConsent()' not in a
a = a.replace(fn_anchor_app, new_app_fn + fn_anchor_app, 1)
app.write_text(a, encoding='utf-8')

css = Path('.github/crm/web/styles.css')
c = css.read_text(encoding='utf-8')
marker = '/* tablet-consent-step1 */'
assert marker not in c
c += r'''

/* tablet-consent-step1 */
.tablet-consent-entry{display:grid;gap:6px;margin:16px 0;padding:14px;border:1px solid #d7e5e8;border-radius:14px;background:#f6fbfb}.tablet-consent-entry small{color:#60757d;line-height:1.45}.tablet-consent-dialog{width:min(860px,calc(100vw - 24px));max-width:860px;border:0;border-radius:22px;padding:0;background:#fff}.tablet-consent-dialog::backdrop{background:rgba(7,31,39,.72)}.tablet-consent-card{padding:clamp(20px,4vw,42px);display:grid;gap:18px}.tablet-consent-brand{display:flex;justify-content:space-between;align-items:end;gap:12px;border-bottom:2px solid #0f7f76;padding-bottom:14px}.tablet-consent-brand strong{font-size:clamp(1.35rem,3vw,2rem);color:#123d4b}.tablet-consent-brand span{font-weight:800;color:#0f7f76}.tablet-consent-complete{margin:0;padding:14px 16px;border-radius:14px;background:#eef7f6;color:#38555e;line-height:1.65}.tablet-consent-customer{font-size:1.15rem;font-weight:900;color:#123d4b;margin:0}.tablet-consent-option{display:grid;gap:10px;padding:18px;border:1px solid #cadde1;border-radius:16px;background:#fff;cursor:pointer}.tablet-consent-option span{font-size:1.05rem;color:#123d4b}.tablet-consent-option input{width:22px;height:22px;vertical-align:middle;margin-right:5px}.tablet-consent-option small{color:#536a72;line-height:1.7}.tablet-consent-option:has(input:checked){border-color:#51ae93;background:#f1fbf7}.tablet-consent-actions{display:grid;grid-template-columns:1.3fr 1fr;gap:10px}.tablet-consent-actions button{min-height:54px;font-size:1rem;font-weight:900}.tablet-consent-result{min-height:1.5em;margin:0;color:#0f7f76;font-weight:800}.tablet-consent-version{text-align:right;color:#819097}@media(max-width:640px){.tablet-consent-dialog{width:100vw;max-width:none;height:100dvh;max-height:100dvh;border-radius:0}.tablet-consent-card{min-height:100%;box-sizing:border-box;padding:20px 16px}.tablet-consent-brand{align-items:start;flex-direction:column}.tablet-consent-actions{grid-template-columns:1fr}.tablet-consent-option{padding:15px}}
'''
css.write_text(c, encoding='utf-8')

test = Path('.github/crm/tests/tablet-consent.test.mjs')
test.write_text(r'''import fs from 'node:fs';
import assert from 'node:assert/strict';
const worker=fs.readFileSync(new URL('../src/worker.js',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
assert.match(worker,/tablet-consent/);
assert.match(worker,/'marketing_use'/);
assert.match(worker,/'ad_sms'/);
assert.match(worker,/customer_direct_action: true/);
assert.match(html,/WB-CONSENT-1\.0/);
assert.match(html,/동의하지 않으셔도 개통·A\/S·기본 상담 이용에는 제한이 없습니다/);
assert.match(app,/openTabletConsent/);
assert.match(app,/submitTabletConsent/);
console.log('tablet consent static checks OK');
''', encoding='utf-8')

pkg = Path('.github/crm/package.json')
p = pkg.read_text(encoding='utf-8')
old = 'node tests/worker-schema.test.mjs && node tests/worker-import.test.mjs'
new = old + ' && node tests/tablet-consent.test.mjs'
assert old in p and 'tablet-consent.test.mjs' not in p
pkg.write_text(p.replace(old, new, 1), encoding='utf-8')

print('CRM tablet consent step 1 patched')
