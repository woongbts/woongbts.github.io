import { INTAKE_READY, INTAKE_PAUSE_MESSAGE } from './intake-readiness.js';
import { validateHandwriting } from '../consent-web/handwriting.js';
const POLICY = Object.freeze({
 version:'WB-INTAKE-20260923-3',operator:'웅비통신 덕천만덕점',title:'고객관리·광고 안내 선택 동의',
 purpose:'[상담 관리 선택] 고객이 요청한 매장 사후상담을 위한 본인 확인 및 연락. [마케팅 이용 선택] 웅비통신의 통신상품·기기변경·행사·프로모션 안내를 위한 이름·연락처 이용. 손글씨와 선택 기록은 동의 사실 확인에 이용합니다.',
 care_label:'[선택] 요청한 사후상담 관리 목적 개인정보 수집·이용 동의',
 linkage_notice:'기존 고객정보 연결은 이름·전화번호 대조에 한정합니다. 이 동의로 기존 개통일·통신사·요금제·단말기·생년월일을 광고 대상 선정에 이용하지 않습니다.',
 items:'휴대전화번호, 손글씨 이름, 손글씨 서명, 직원이 확인하여 정리한 이름',
 retention:'동의일로부터 최대 3년. 해당 목적의 동의 철회 또는 처리 목적 달성으로 불필요해지면 먼저 종료합니다. 법정 의무 보관기간이 아닌 매장 운영기간입니다.',
 refusal:'모두 선택 사항입니다. 동의하지 않아도 개통·A/S·기본 상담 이용에는 제한이 없습니다.',
 withdrawal:'매장 방문 또는 대표전화 051-343-7677로 동의 철회를 요청할 수 있습니다. 매장에서 본인 확인 후 처리합니다.',
 advertising:'웅비통신의 통신상품, 요금·결합 혜택, 기기변경, 매장 행사 및 프로모션 정보를 선택한 채널로 안내합니다.',
 privacy_label:'[선택] 상품·행사 안내 등 마케팅 목적 개인정보 수집·이용 동의',
 advertising_label:'[선택] 광고성 정보 수신 동의',
 channels:{ad_sms:'문자(SMS/MMS)',ad_kakao:'카카오톡',ad_call:'전화'},
 channel_notice:'채널별로 선택할 수 있으며 언제든 철회할 수 있습니다. 야간 광고 수신동의는 받지 않습니다.',
 adult_notice:'성인 고객 본인이 작성하는 화면입니다. 미성년자·대리인은 직원에게 문의해 주세요.',
 record_notice:'직원이 준비한 선택 내용을 고객이 확인하고 손글씨 이름·서명과 함께 접수합니다. 선택 결과, 동의 문구의 버전, 서버 접수 시각을 함께 기록합니다. 접수 정보는 직원 확인 후 고객관리용으로 사용합니다.'
});
const PURPOSES=['customer_care','marketing_use','ad_sms','ad_kakao','ad_call'];
export const INTAKE_DDL=[
 "CREATE TABLE IF NOT EXISTS consent_intakes (id TEXT PRIMARY KEY,payload_enc TEXT NOT NULL,phone_hmac TEXT NOT NULL,form_hash TEXT NOT NULL,form_json TEXT NOT NULL,captured_at TEXT NOT NULL,expires_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed')),customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,reviewed_at TEXT,reviewed_by_enc TEXT)",
 'CREATE INDEX IF NOT EXISTS idx_consent_intakes_expiry ON consent_intakes(expires_at)',
 'CREATE INDEX IF NOT EXISTS idx_consent_intakes_phone ON consent_intakes(phone_hmac)',
 "CREATE TABLE IF NOT EXISTS consent_intake_actions (id TEXT PRIMARY KEY,intake_id TEXT NOT NULL REFERENCES consent_intakes(id) ON DELETE CASCADE,kind TEXT NOT NULL CHECK(kind IN ('channel_withdrawal','notice')),target TEXT NOT NULL,created_at TEXT NOT NULL,actor_enc TEXT NOT NULL,method TEXT,UNIQUE(intake_id,kind,target))",
 'CREATE INDEX IF NOT EXISTS idx_intake_actions_parent ON consent_intake_actions(intake_id)'
];
async function digest(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
function expireDate(now,years=3){const d=new Date(now),m=d.getUTCMonth();d.setUTCFullYear(d.getUTCFullYear()+years);if(d.getUTCMonth()!==m)d.setUTCDate(0);return d.toISOString();}
export function createIntakeHandlers(h){
 const policyJson=JSON.stringify(POLICY);
 return {
 async ensure(env){await env.DB.batch(INTAKE_DDL.map(s=>env.DB.prepare(s)));},
 async purge(env){await env.DB.prepare('DELETE FROM consent_intakes WHERE expires_at<=?').bind(new Date().toISOString()).run();},
 async form(){return {ok:true,enabled:INTAKE_READY,message:INTAKE_READY?'':INTAKE_PAUSE_MESSAGE,policy:POLICY,form_hash:await digest(policyJson)};},
 async submit(env,body){
  if(!INTAKE_READY)throw h.httpError(423,INTAKE_PAUSE_MESSAGE);
  if(!body||body.form_hash!==await digest(policyJson))throw h.httpError(409,'동의 내용을 새로 불러와 주세요.');
  if(body.website)throw h.httpError(400,'접수 내용을 확인해 주세요.');
  if(!body.choices||PURPOSES.some(p=>typeof body.choices[p]!=='boolean'))throw h.httpError(400,'선택 항목을 확인해 주세요.');
  if(!body.choices.marketing_use&&PURPOSES.slice(2).some(p=>body.choices[p]))throw h.httpError(400,'광고 채널 선택에는 마케팅 목적 개인정보 이용 동의가 필요합니다.');
  if(!body.choices.marketing_use&&!body.choices.customer_care)return {ok:true,saved:false};
  if(body.adult_confirmed!==true)throw h.httpError(400,'성인 고객 본인이 작성하는지 확인해 주세요.');
  if(body.customer_confirmed!==true)throw h.httpError(400,'고객님께서 선택 내용을 확인한 뒤 접수해 주세요.');
  let handwriting_name,signature;
  try{handwriting_name=validateHandwriting(body.handwriting_name);signature=validateHandwriting(body.signature);}catch(e){throw h.httpError(400,e.message);}
  const phone=String(body.phone||'').replace(/[\s()-]/g,'');
  if(!/^01[016789]\d{7,8}$/.test(phone))throw h.httpError(400,'휴대전화번호를 확인해 주세요.');
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.request_id||''))throw h.httpError(400,'페이지를 새로 열고 다시 작성해 주세요.');
  const now=new Date().toISOString(),choices=Object.fromEntries(PURPOSES.map(p=>[p,body.choices[p]]));
  const payload=JSON.stringify({name:'',phone,choices,adult_confirmed:true,customer_confirmed:true,capture_method:'staff_prepared_customer_handwritten',handwriting_name,signature});
  await env.DB.prepare('INSERT OR IGNORE INTO consent_intakes(id,payload_enc,phone_hmac,form_hash,form_json,captured_at,expires_at) VALUES(?,?,?,?,?,?,?)')
   .bind(body.request_id,await h.encryptText(payload,env),await h.phoneHmac(phone,env),body.form_hash,policyJson,now,expireDate(now)).run();
  const saved=await env.DB.prepare('SELECT payload_enc,captured_at FROM consent_intakes WHERE id=?').bind(body.request_id).first();
  if(!saved||await h.decryptText(saved.payload_enc,env)!==payload)throw h.httpError(409,'이미 처리된 요청입니다. 새로고침 후 다시 작성해 주세요.');
  return {ok:true,saved:true,receipt:{operator:POLICY.operator,captured_at:saved.captured_at,choices,status:'접수됨 · 직원 본인 확인 대기'}};
 },
 async list(env,url){
  await this.purge(env);
  const before=url.searchParams.get('before'),params=[];let clause='';
  if(before){if(!/^\d+$/.test(before))throw h.httpError(400,'목록 범위를 확인해 주세요.');clause=' WHERE rowid<?';params.push(Number(before));}
  const rows=await env.DB.prepare('SELECT rowid AS seq,* FROM consent_intakes'+clause+' ORDER BY rowid DESC LIMIT 51').bind(...params).all();
  const items=[];
  for(const row of rows.results.slice(0,50)){
   const payload=JSON.parse(await h.decryptText(row.payload_enc,env));
   const match=await env.DB.prepare("SELECT id,name_enc FROM customers WHERE phone_hmac=? AND customer_status='active'").bind(row.phone_hmac).first();
   let reviewedName='';
   if(row.reviewed_by_enc){try{reviewedName=JSON.parse(await h.decryptText(row.reviewed_by_enc,env)).name||'';}catch{}}
   const exact=match&&h.normalizeName(await h.decryptText(match.name_enc,env))===h.normalizeName(reviewedName||payload.name);
   const {handwriting_name,signature,...summary}=payload;
   const actions=(await env.DB.prepare('SELECT id,kind,target,created_at,method FROM consent_intake_actions WHERE intake_id=? ORDER BY created_at,id').bind(row.id).all()).results;
   const effectiveChoices={...payload.choices};for(const a of actions)if(a.kind==='channel_withdrawal')effectiveChoices[a.target]=false;
   const periodicDue=expireDate(row.captured_at,2);
   const notices=actions.filter(a=>a.kind==='notice').map(a=>a.target);
   const noticeTasks=[...(Object.keys(POLICY.channels).some(p=>payload.choices[p])&&!notices.includes('initial')?[{target:'initial',label:'최초 수신동의 처리 결과 안내',due:new Date(Date.parse(row.captured_at)+14*86400000).toISOString()}]:[]),...actions.filter(a=>a.kind==='channel_withdrawal'&&!notices.includes(a.id)).map(a=>({target:a.id,label:POLICY.channels[a.target]+' 철회 처리 결과 안내',due:new Date(Date.parse(a.created_at)+14*86400000).toISOString()})),...(Object.keys(POLICY.channels).some(p=>effectiveChoices[p])&&!notices.includes('periodic')?[{target:'periodic',label:'2년 주기 수신동의 확인 안내',due:periodicDue}]:[])];
   items.push({id:row.id,...summary,effective_choices:effectiveChoices,actions,notice_tasks:noticeTasks,name:reviewedName||payload.name,has_handwriting:!!handwriting_name,captured_at:row.captured_at,expires_at:row.expires_at,status:row.status,reviewed_at:row.reviewed_at,customer_id:row.customer_id,match:exact?'exact':match?(handwriting_name?'phone_only':'different_name'):'new',form:JSON.parse(row.form_json)});
  }
  return h.json({ok:true,collection_enabled:INTAKE_READY,collection_message:INTAKE_PAUSE_MESSAGE,items,next_cursor:rows.results.length>50?String(rows.results[49].seq):null});
 },
 async handwriting(env,id){
  const row=await env.DB.prepare('SELECT payload_enc FROM consent_intakes WHERE id=? AND expires_at>?').bind(id,new Date().toISOString()).first();
  if(!row)throw h.httpError(404,'접수 내역이 없거나 보유기간이 지났습니다.');
  const p=JSON.parse(await h.decryptText(row.payload_enc,env));
  return h.json({ok:true,handwriting_name:p.handwriting_name||null,signature:p.signature||null});
 },
 async review(request,env,user,id){
  h.requireSameOrigin(request);
  const body=await h.readJson(request);if(body.confirmed!==true)throw h.httpError(400,'고객 본인의 접수인지 확인해 주세요.');
  const row=await env.DB.prepare('SELECT * FROM consent_intakes WHERE id=? AND expires_at>?').bind(id,new Date().toISOString()).first();
  if(!row)throw h.httpError(404,'접수 내역이 없거나 보유기간이 지났습니다.');
  const payload=JSON.parse(await h.decryptText(row.payload_enc,env));
  const reviewedName=String(body.name||payload.name||'').normalize('NFC').trim().replace(/\s+/g,' ');
  if(reviewedName.length<2||reviewedName.length>40||/[\u0000-\u001f<>&]/.test(reviewedName))throw h.httpError(400,'손글씨 이름을 확인하고 문자로 입력해 주세요.');
  if(payload.handwriting_name&&body.handwriting_checked!==true)throw h.httpError(400,'손글씨 이름과 서명을 확인해 주세요.');
  const match=await env.DB.prepare("SELECT id,name_enc FROM customers WHERE phone_hmac=? AND customer_status='active'").bind(row.phone_hmac).first();
  if(match&&h.normalizeName(await h.decryptText(match.name_enc,env))!==h.normalizeName(reviewedName))throw h.httpError(409,'기존 고객의 이름과 다릅니다. 본인과 입력 내용을 확인한 후 다시 접수해 주세요.');
  await env.DB.prepare("UPDATE consent_intakes SET status='confirmed',customer_id=?,reviewed_at=?,reviewed_by_enc=? WHERE id=? AND status='pending'")
   .bind(match?.id||null,new Date().toISOString(),await h.encryptText(JSON.stringify({email:user.email,name:reviewedName}),env),id).run();
  return h.json({ok:true});
 },
 async channel(request,env,user,id){
  h.requireSameOrigin(request);const body=await h.readJson(request);
  if(body.confirmed!==true||!Object.hasOwn(POLICY.channels,body.channel))throw h.httpError(400,'고객의 철회 요청과 채널을 확인해 주세요.');
  const row=await env.DB.prepare('SELECT phone_hmac FROM consent_intakes WHERE id=? AND expires_at>?').bind(id,new Date().toISOString()).first();
  if(!row)throw h.httpError(404,'접수 내역이 없거나 보유기간이 지났습니다.');
  const now=new Date().toISOString(),actor=await h.encryptText(user.email,env);
  const siblings=(await env.DB.prepare('SELECT id FROM consent_intakes WHERE phone_hmac=?').bind(row.phone_hmac).all()).results;
  const statements=siblings.map(r=>env.DB.prepare("INSERT OR IGNORE INTO consent_intake_actions(id,intake_id,kind,target,created_at,actor_enc) VALUES(?,?,'channel_withdrawal',?,?,?)").bind(crypto.randomUUID(),r.id,body.channel,now,actor));
  const customer=await env.DB.prepare('SELECT id FROM customers WHERE phone_hmac=?').bind(row.phone_hmac).first();
  if(customer){
   // Preserve other channels; withdrawal never creates a grant.
   statements.push(env.DB.prepare("INSERT INTO consent_events(id,customer_id,choices_json,captured_at,capture_method,actor_enc,receipt_id) VALUES(?,?,?,?,'staff_channel_withdrawal',?,?)").bind(crypto.randomUUID(),customer.id,JSON.stringify({[body.channel]:'withdrawn'}),now,actor,crypto.randomUUID()));
   if(body.channel==='ad_sms')statements.push(env.DB.prepare("INSERT INTO consents(id,customer_id,purpose,status,captured_at,capture_method,revoked_at,created_at) VALUES(?,?,'ad_sms','revoked',?,'other',?,?)").bind(crypto.randomUUID(),customer.id,now,now,now));
  }
  await env.DB.batch(statements);
  return h.json({ok:true,notice:'철회 처리되었습니다. 고객에게 매장명·철회일·채널·처리 결과를 안내하고 안내 기록을 남겨 주세요.'});
 },
 async notice(request,env,user,id){
  h.requireSameOrigin(request);const body=await h.readJson(request);
  if(body.confirmed!==true||!['in_person','paper','sms','kakao','phone'].includes(body.method))throw h.httpError(400,'실제로 안내한 방법과 안내 완료 여부를 확인해 주세요.');
  const row=await env.DB.prepare('SELECT captured_at,payload_enc FROM consent_intakes WHERE id=? AND expires_at>?').bind(id,new Date().toISOString()).first();
  if(!row)throw h.httpError(404,'접수 내역이 없거나 보유기간이 지났습니다.');
  const p=JSON.parse(await h.decryptText(row.payload_enc,env));
  if(['initial','periodic'].includes(body.target)){
   if(!Object.keys(POLICY.channels).some(k=>p.choices[k]))throw h.httpError(400,'광고 수신동의 대상 접수가 아닙니다.');
   if(body.target==='periodic'&&Date.now()<Date.parse(expireDate(row.captured_at,2))-30*86400000)throw h.httpError(400,'2년 주기 안내 예정일 30일 전부터 기록할 수 있습니다.');
  }else if(!(await env.DB.prepare("SELECT id FROM consent_intake_actions WHERE id=? AND intake_id=? AND kind='channel_withdrawal'").bind(String(body.target||''),id).first()))throw h.httpError(400,'안내할 처리 내역을 확인해 주세요.');
  await env.DB.prepare("INSERT OR IGNORE INTO consent_intake_actions(id,intake_id,kind,target,created_at,actor_enc,method) VALUES(?,?,'notice',?,?,?,?)").bind(crypto.randomUUID(),id,body.target,new Date().toISOString(),await h.encryptText(user.email,env),body.method).run();
  return h.json({ok:true});
 },
 async remove(request,env,user,id){
  h.requireSameOrigin(request);
  const body=await h.readJson(request);if(body.confirmed!==true)throw h.httpError(400,'철회 또는 잘못된 접수인지 확인해 주세요.');
  if(body.withdraw===true){
   const row=await env.DB.prepare('SELECT phone_hmac FROM consent_intakes WHERE id=?').bind(id).first();
   if(row){
    const customer=await env.DB.prepare('SELECT id FROM customers WHERE phone_hmac=?').bind(row.phone_hmac).first();
    if(customer){
     const copy=new Request(request.url,{method:'POST',headers:request.headers,body:JSON.stringify({confirmed:true})});
     await h.withdrawConsent(copy,env,user,customer.id);
    }
    await env.DB.prepare('DELETE FROM consent_intakes WHERE phone_hmac=?').bind(row.phone_hmac).run();
   }
  } else await env.DB.prepare('DELETE FROM consent_intakes WHERE id=?').bind(id).run();
  return h.json({ok:true,...(body.withdraw===true?{notice:'전체 철회를 처리했습니다. 고객에게 웅비통신의 전체 철회 처리 사실과 오늘 날짜를 안내해 주세요. 안내 통지 자체가 자동 발송되지는 않습니다.'}:{})});
 },
 async removeForCustomer(env,id){await env.DB.prepare('DELETE FROM consent_intakes WHERE customer_id=? OR phone_hmac=(SELECT phone_hmac FROM customers WHERE id=?)').bind(id,id).run();}
 };
}
