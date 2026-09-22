const POLICY = Object.freeze({
 version:'WB-INTAKE-20260922-1',operator:'웅비통신 덕천만덕점',title:'고객관리·광고 안내 선택 동의',
 purpose:'매장의 고객관리 상담, 약정·요금할인 종료 안내, 통신비·결합할인 점검, 기기변경 및 매장 행사·프로모션 안내',
 items:'이름, 휴대전화번호',
 retention:'동의일로부터 3년 또는 동의 철회 시까지 중 먼저 도래하는 때',
 refusal:'모두 선택 사항입니다. 동의하지 않아도 개통·A/S·기본 상담 이용에는 제한이 없습니다.',
 withdrawal:'매장 방문 또는 대표전화 051-343-7677로 동의 철회를 요청할 수 있습니다. 매장에서 본인 확인 후 처리합니다.',
 advertising:'웅비통신의 통신상품, 요금·결합 혜택, 기기변경, 매장 행사 및 프로모션 정보를 선택한 채널로 안내합니다.',
 privacy_label:'[선택] 고객관리·마케팅 목적 개인정보 수집·이용 동의',
 advertising_label:'[선택] 광고성 정보 수신 동의',
 channels:{ad_sms:'문자(SMS/MMS)',ad_kakao:'카카오톡',ad_call:'전화'},
 channel_notice:'채널별로 선택할 수 있으며 언제든 철회할 수 있습니다. 야간 광고 수신동의는 받지 않습니다.',
 adult_notice:'성인 고객 본인이 작성하는 화면입니다. 미성년자·대리인은 직원에게 문의해 주세요.',
 record_notice:'선택 결과, 동의 문구의 버전, 접수 시각을 함께 기록합니다. 접수 정보는 직원 확인 후 고객관리용으로 사용합니다.'
});
const PURPOSES=['marketing_use','ad_sms','ad_kakao','ad_call'];
export const INTAKE_DDL=[
 "CREATE TABLE IF NOT EXISTS consent_intakes (id TEXT PRIMARY KEY,payload_enc TEXT NOT NULL,phone_hmac TEXT NOT NULL,form_hash TEXT NOT NULL,form_json TEXT NOT NULL,captured_at TEXT NOT NULL,expires_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed')),customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,reviewed_at TEXT,reviewed_by_enc TEXT)",
 'CREATE INDEX IF NOT EXISTS idx_consent_intakes_expiry ON consent_intakes(expires_at)',
 'CREATE INDEX IF NOT EXISTS idx_consent_intakes_phone ON consent_intakes(phone_hmac)'
];
async function digest(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
function expireDate(now){const d=new Date(now),m=d.getUTCMonth();d.setUTCFullYear(d.getUTCFullYear()+3);if(d.getUTCMonth()!==m)d.setUTCDate(0);return d.toISOString();}
export function createIntakeHandlers(h){
 const policyJson=JSON.stringify(POLICY);
 return {
 async ensure(env){await env.DB.batch(INTAKE_DDL.map(s=>env.DB.prepare(s)));},
 async purge(env){await env.DB.prepare('DELETE FROM consent_intakes WHERE expires_at<=?').bind(new Date().toISOString()).run();},
 async form(){return {ok:true,policy:POLICY,form_hash:await digest(policyJson)};},
 async submit(env,body){
  if(!body||body.form_hash!==await digest(policyJson))throw h.httpError(409,'동의 내용을 새로 불러와 주세요.');
  if(body.website)throw h.httpError(400,'접수 내용을 확인해 주세요.');
  if(!body.choices||PURPOSES.some(p=>typeof body.choices[p]!=='boolean'))throw h.httpError(400,'선택 항목을 확인해 주세요.');
  if(!body.choices.marketing_use){
   if(PURPOSES.slice(1).some(p=>body.choices[p]))throw h.httpError(400,'광고 채널 선택에는 개인정보 수집·이용 동의가 필요합니다.');
   return {ok:true,saved:false};
  }
  if(body.adult_confirmed!==true)throw h.httpError(400,'성인 고객 본인이 작성하는지 확인해 주세요.');
  const name=String(body.name||'').normalize('NFC').trim().replace(/\s+/g,' ');
  const phone=String(body.phone||'').replace(/[\s()-]/g,'');
  if(name.length<2||name.length>40||/[\u0000-\u001f<>&]/.test(name))throw h.httpError(400,'이름을 2~40자로 입력해 주세요.');
  if(!/^01[016789]\d{7,8}$/.test(phone))throw h.httpError(400,'휴대전화번호를 확인해 주세요.');
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.request_id||''))throw h.httpError(400,'페이지를 새로 열고 다시 작성해 주세요.');
  const now=new Date().toISOString(),choices=Object.fromEntries(PURPOSES.map(p=>[p,body.choices[p]]));
  const payload=JSON.stringify({name,phone,choices,adult_confirmed:true});
  await env.DB.prepare('INSERT OR IGNORE INTO consent_intakes(id,payload_enc,phone_hmac,form_hash,form_json,captured_at,expires_at) VALUES(?,?,?,?,?,?,?)')
   .bind(body.request_id,await h.encryptText(payload,env),await h.phoneHmac(phone,env),body.form_hash,policyJson,now,expireDate(now)).run();
  const saved=await env.DB.prepare('SELECT payload_enc FROM consent_intakes WHERE id=?').bind(body.request_id).first();
  if(!saved||await h.decryptText(saved.payload_enc,env)!==payload)throw h.httpError(409,'이미 처리된 요청입니다. 새로고침 후 다시 작성해 주세요.');
  return {ok:true,saved:true};
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
   const exact=match&&h.normalizeName(await h.decryptText(match.name_enc,env))===h.normalizeName(payload.name);
   items.push({id:row.id,...payload,captured_at:row.captured_at,expires_at:row.expires_at,status:row.status,reviewed_at:row.reviewed_at,customer_id:row.customer_id,match:exact?'exact':match?'different_name':'new',form:JSON.parse(row.form_json)});
  }
  return h.json({ok:true,items,next_cursor:rows.results.length>50?String(rows.results[49].seq):null});
 },
 async review(request,env,user,id){
  h.requireSameOrigin(request);
  const body=await h.readJson(request);if(body.confirmed!==true)throw h.httpError(400,'고객 본인의 접수인지 확인해 주세요.');
  const row=await env.DB.prepare('SELECT * FROM consent_intakes WHERE id=? AND expires_at>?').bind(id,new Date().toISOString()).first();
  if(!row)throw h.httpError(404,'접수 내역이 없거나 보유기간이 지났습니다.');
  const payload=JSON.parse(await h.decryptText(row.payload_enc,env));
  const match=await env.DB.prepare("SELECT id,name_enc FROM customers WHERE phone_hmac=? AND customer_status='active'").bind(row.phone_hmac).first();
  if(match&&h.normalizeName(await h.decryptText(match.name_enc,env))!==h.normalizeName(payload.name))throw h.httpError(409,'기존 고객의 이름과 다릅니다. 본인과 입력 내용을 확인한 후 다시 접수해 주세요.');
  await env.DB.prepare("UPDATE consent_intakes SET status='confirmed',customer_id=?,reviewed_at=?,reviewed_by_enc=? WHERE id=? AND status='pending'")
   .bind(match?.id||null,new Date().toISOString(),await h.encryptText(user.email,env),id).run();
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
  return h.json({ok:true});
 },
 async removeForCustomer(env,id){await env.DB.prepare('DELETE FROM consent_intakes WHERE customer_id=? OR phone_hmac=(SELECT phone_hmac FROM customers WHERE id=?)').bind(id,id).run();}
 };
}
