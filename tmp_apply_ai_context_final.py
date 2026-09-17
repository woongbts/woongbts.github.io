from pathlib import Path
from collections import Counter
import json
import tmp_ai_context_upgrade as base

EXPECTED = {"MOBINGSKT":12,"MOBINGKT":13,"MOBINGLG":14,"FREETSKT":7,"FREETKT":6,"FREETLG":9}
NETWORK = {"MOBINGSKT":"SKT","MOBINGKT":"KT","MOBINGLG":"LGU+","FREETSKT":"SKT","FREETKT":"KT","FREETLG":"LGU+"}

def local_audit():
    data=json.loads(Path('data/prepaid.json').read_text(encoding='utf-8'))
    providers=data.get('providers') or []
    plans=data.get('plans') or []
    pids=[p.get('id') for p in providers]
    if pids != list(EXPECTED):
        raise SystemExit(f'provider order mismatch {pids}')
    ids=[p.get('id') for p in plans]
    if len(ids)!=len(set(ids)):
        raise SystemExit('duplicate prepaid plan id')
    counts=Counter(p.get('provider_id') for p in plans)
    if dict(counts)!=EXPECTED:
        raise SystemExit(f'prepaid count mismatch {dict(counts)}')
    for p in plans:
        pid=p.get('provider_id')
        if pid not in EXPECTED: raise SystemExit(f'unknown provider {pid}')
        if p.get('network') != NETWORK[pid]: raise SystemExit(f'network mismatch {p.get("id")}')
        if not str(p.get('name') or '').strip(): raise SystemExit(f'blank name {p.get("id")}')
        if not isinstance(p.get('monthly_fee'), int) or p['monthly_fee'] < 0: raise SystemExit(f'bad fee {p.get("id")}')
        for k in ('voice','sms','data'):
            if not str(p.get(k) or '').strip(): raise SystemExit(f'blank {k} {p.get("id")}')
    byid={p['id']:p for p in plans}
    samples={
        'PRE-MOBINGSKT-1709':('band 데이터 세이브',33000,'300MB'),
        'PRE-MOBINGSKT-1710':('band 데이터 안심 300',36000,'300MB+3Mbps 무제한'),
        'PRE-MOBINGSKT-1711':('band 데이터 1.2',38000,'1.2GB'),
        'PRE-MOBINGSKT-1712':('band 15G+',39000,'15GB+3Mbps 무제한'),
        'PRE-MOBINGSKT-1713':('band 데이터 2.2',45000,'2.2GB'),
    }
    for pid,(name,fee,data_text) in samples.items():
        p=byid.get(pid)
        if not p or (p['name'],p['monthly_fee'],p['data']) != (name,fee,data_text):
            raise SystemExit(f'sample mismatch {pid}: {p}')
    raw=Path('data/prepaid.json').read_text(encoding='utf-8').lower()
    for banned in ('리베이트','commission','rebate','수수료','제로노트','xeronote'):
        if banned in raw: raise SystemExit(f'sensitive term in customer data: {banned}')
    print('local prepaid audit ok', dict(counts), 'total', len(plans))

base.audit_prepaid = local_audit
base.main()

# Add a small health route so deployment can be verified without invoking AI.
wpath=Path('worker.js')
w=wpath.read_text(encoding='utf-8')
needle='''    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });\n    if (request.method !== "POST") return json({ error: "POST 요청만 사용할 수 있습니다." }, 405, corsHeaders);'''
replacement='''    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });\n    if (request.method === "GET" && new URL(request.url).pathname === "/health") return json({ ok: true, version: "20260917-context-3" }, 200, corsHeaders);\n    if (request.method !== "POST") return json({ error: "POST 요청만 사용할 수 있습니다." }, 405, corsHeaders);'''
if needle not in w: raise SystemExit('worker method marker missing')
w=w.replace(needle,replacement,1)

# Use the active rate tab to look up the public plan catalog even when the customer says only “이거/여기”.
w=w.replace('const catalogAnswer = await answerFromPublicCatalog(question);','const catalogAnswer = await answerFromPublicCatalog(question, context);',1)
w=w.replace('async function answerFromPublicCatalog(question) {','async function answerFromPublicCatalog(question, context = {}) {',1)
w=w.replace('''  if (/(선불|모빙|프리티)/.test(q)) {''','''  if (/(선불|모빙|프리티)/.test(q) || context.active_tab === "prepaid") {''',1)
w=w.replace('''  if (/(알뜰|mvno|후불 유심|유심 요금)/.test(q)) {''','''  if (/(알뜰|mvno|후불 유심|유심 요금)/.test(q) || context.active_tab === "mvno") {''',1)
wpath.write_text(w,encoding='utf-8')

# Improve the client-side timeout message when a rate selection is already visible.
apath=Path('assets/ai-chat.min.js')
a=apath.read_text(encoding='utf-8')
old='''p(e&&"AbortError"===e.name?"응답이 조금 늦어지고 있어요. 잠시 후 다시 질문해 주세요.":"AI 안내 연결에 문제가 생겼어요. 전화 051-343-7677 또는 카카오톡으로 문의해 주세요.","bot")'''
new='''(()=>{const t=f();return p(e&&"AbortError"===e.name?(t.selection?`응답이 조금 늦어졌어요. 지금 화면에는 ${t.selection} 조건이 선택되어 있습니다. 월요금·데이터량·다른 요금제 비교 중 무엇이 궁금한지 한 가지만 말씀해주시면 이어서 볼게요.`:"응답이 조금 늦어지고 있어요. 잠시 후 다시 질문해 주세요."):"AI 안내 연결에 문제가 생겼어요. 전화 051-343-7677 또는 카카오톡으로 문의해 주세요.","bot")})()'''
if old not in a: raise SystemExit('client timeout marker missing')
a=a.replace(old,new,1)
apath.write_text(a,encoding='utf-8')

print('final contextual AI files prepared')
