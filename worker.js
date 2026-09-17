// Git-connected Cloudflare Worker for Woongbi AI
const SITE = "https://woongbts.github.io";

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "https://woongbts.github.io",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method === "GET" && new URL(request.url).pathname === "/health") return json({ ok: true, version: "20260917-context-3" }, 200, corsHeaders);
    if (request.method !== "POST") return json({ error: "POST 요청만 사용할 수 있습니다." }, 405, corsHeaders);

    let body;
    try { body = await request.json(); }
    catch { return json({ error: "질문 형식을 확인해주세요." }, 400, corsHeaders); }

    const question = String(body?.question || "").trim().slice(0, 400);
    const context = normalizeContext(body?.context);
    const history = normalizeHistory(body?.history);
    if (!question) return json({ error: "질문을 입력해주세요." }, 400, corsHeaders);

    const known = answerKnownQuestion(question, context, history);
    if (known) return json({ answer: known, source: "store-context" }, 200, corsHeaders);

    try {
      const catalogAnswer = await answerFromPublicCatalog(question, context);
      if (catalogAnswer) return json({ answer: catalogAnswer, source: "public-catalog" }, 200, corsHeaders);
    } catch (error) {
      console.log("catalog lookup error", String(error?.stack || error));
    }

    const contextText = contextToText(context);
    const historyText = history.slice(-6).map(x => `${x.role === "assistant" ? "안내" : "고객"}: ${x.content}`).join("\n") || "없음";
    const systemPrompt = `너는 부산 북구 만덕동 '웅비통신 덕천만덕점'의 AI 안내 도우미다.

매장 정보:
- 상호명: 웅비통신 덕천만덕점
- 주소: 부산광역시 북구 만덕대로178번길 17
- 전화: 051-343-7677
- 영업시간: 월요일~토요일 오전 11시~오후 8시 / 매주 일요일 휴무
- 통신업 경력 16년, 현 위치 7년째 운영
- 취급: 휴대폰, 알뜰폰, 선불폰, 인터넷·TV, 중고폰 매입, 정수기·생활가전 렌탈

현재 페이지 맥락:
${contextText}

최근 대화:
${historyText}

응답 규칙:
1. 한국어로 친절하고 구체적으로, 보통 2~5문장으로 답한다.
2. 고객이 '여기', '이거', '이 요금제', '그 조건'처럼 말하면 현재 페이지의 선택값과 최근 대화를 먼저 참고한다.
3. 선택된 요금제나 견적 정보가 있으면 그것을 다시 짚고, 고객의 사용량·예산과 맞는지 판단하는 데 필요한 다음 질문을 하나만 구체적으로 한다.
4. 단순히 '매장에 문의하세요'로 끝내지 말고, 화면에 확인되는 범위는 먼저 설명한다.
5. 확인되지 않은 가격, 지원금, 재고, 사은품, 개통 가능 여부를 만들어내지 않는다. 확인되지 않은 부분만 전화 051-343-7677 또는 카카오톡 상담을 안내한다.
6. 온라인 전용 알뜰폰처럼 매장에서 취급하지 않는 상품이 있을 수 있음을 필요할 때만 설명한다.
7. 개인정보, 신분증 정보, 계좌번호, 비밀번호 등을 입력하라고 요구하지 않는다.
8. 매장과 무관한 질문이면 매장 이용과 관련된 질문을 도와드릴 수 있다고 짧게 안내한다.`;

    const prior = history.slice(-6);
    if (prior.length && prior.at(-1)?.role === "user" && prior.at(-1)?.content === question) prior.pop();
    const messages = [{ role: "system", content: systemPrompt }, ...prior, { role: "user", content: question }];
    const models = ["@cf/zai-org/glm-4.7-flash", "@cf/google/gemma-4-26b-a4b-it"];

    for (const model of models) {
      try {
        const options = { messages, max_completion_tokens: 240, temperature: 0.25 };
        if (model.includes("gemma")) options.chat_template_kwargs = { enable_thinking: false };
        const result = await withTimeout(env.AI.run(model, options), 5200);
        const answer = extractAnswer(result);
        if (answer) return json({ answer, source: model }, 200, corsHeaders);
      } catch (error) {
        console.log("Workers AI model error", model, String(error?.stack || error));
      }
    }

    return json({ answer: fallbackAnswer(question, context), source: "store-fallback" }, 200, corsHeaders);
  },
};

function normalizeContext(value) {
  if (!value || typeof value !== "object") return {};
  const out = {};
  for (const key of ["page", "title", "active_tab", "selection", "summary", "details"]) {
    if (typeof value[key] === "string") out[key] = value[key].trim().slice(0, 800);
  }
  return out;
}

function normalizeHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-8).map(x => ({
    role: x?.role === "assistant" ? "assistant" : "user",
    content: String(x?.content || "").trim().slice(0, 350),
  })).filter(x => x.content);
}

function contextToText(context) {
  const rows = [];
  if (context.page) rows.push(`페이지: ${context.page}`);
  if (context.active_tab) rows.push(`현재 메뉴: ${context.active_tab}`);
  if (context.selection) rows.push(`선택값: ${context.selection}`);
  if (context.summary) rows.push(`화면 요약: ${context.summary}`);
  if (context.details) rows.push(`상세: ${context.details}`);
  return rows.join("\n") || "선택된 상품 정보 없음";
}

function answerKnownQuestion(question, context, history) {
  const q = question.toLowerCase().replace(/\s+/g, " ");
  if (/(여기|이거|이 요금제|이 조건|그 조건|지금 조건|괜찮|좋나요|좋은가|어때)/.test(q) && /(요금제|조건|여기|이거|괜찮|좋|어때)/.test(q)) {
    return answerCurrentCondition(context, history);
  }
  if (/(부모님|효도폰|어르신)/.test(q)) {
    return "부모님 휴대폰은 단순히 가장 싼 것보다 화면 크기·통화량·데이터 사용량·사용 편의성을 같이 보는 게 좋아요. 요금 계산 페이지의 ‘효도폰’ 추천에서 먼저 비교할 수 있고, 평소 데이터 사용량이 거의 없는지 유튜브·카톡을 자주 쓰시는지만 알려주시면 범위를 더 좁혀드릴게요.";
  }
  if (/(아이|키즈폰|어린이|초등)/.test(q) && /(폰|휴대폰|요금|추천)/.test(q)) {
    return "아이 첫 휴대폰이라면 키즈폰 전용 조건과 일반 보급형을 함께 보는 게 좋아요. 현재 사이트의 ‘키즈폰’ 추천에는 신규가입 행사 조건을 따로 표시하고 있으니, 통화 위주인지 데이터도 필요한지만 알려주시면 맞는 방향을 설명해드릴게요.";
  }
  if (/(공시지원|선택약정|선약)/.test(q)) {
    return "공시지원금은 기기값을 바로 낮추는 방식이고, 선택약정은 통신요금에서 25%를 할인받는 방식입니다. 같은 기종·요금제라도 어느 쪽이 유리한지는 지원금과 월요금에 따라 달라지므로 요금 계산 페이지에서 두 방식을 함께 비교해보는 게 가장 정확합니다.";
  }
  if (/(기기변경|기변|번호이동|번이|신규가입)/.test(q) && /(차이|뭐|어떤|좋|유리)/.test(q)) {
    return "기기변경은 번호와 통신사를 유지한 채 기기만 바꾸는 것이고, 번호이동은 번호는 유지하면서 통신사를 옮기는 방식입니다. 신규가입은 새 번호로 개통하는 경우이고, 실제 혜택은 시점·기종마다 달라 사이트 계산값과 매장 최종 조건을 함께 확인하면 됩니다.";
  }
  if (/(오늘|영업|운영|문.?열|오픈|몇시|몇 시|일요일|휴무)/.test(q)) return "웅비통신 덕천만덕점은 월요일부터 토요일까지 오전 11시~오후 8시 영업하며, 매주 일요일은 휴무입니다.";
  if (/(주소|위치|어디|오시는|가는길|가는 길|남산정)/.test(q)) return "웅비통신 덕천만덕점은 부산광역시 북구 만덕대로178번길 17에 있습니다. 남산정역 3번 출구에서 도보 약 1분 거리입니다.";
  if (/(선불폰|선불 폰)/.test(q) && !/(요금제|얼마|추천|데이터|gb|기가|만원)/.test(q)) return "선불폰 상담이 가능하고, 현재 사이트에는 웅비통신에서 취급하는 모빙·프리티의 SKT·KT·LGU+망 선불 USIM 요금제를 따로 정리해두었습니다. 원하는 통신망이나 월 예산을 말씀해주시면 어떤 구간부터 보면 좋을지 바로 좁혀드릴게요.";
  if (/(알뜰폰|알뜰 폰|mvno|유심)/.test(q) && !/(요금제|얼마|추천|데이터|gb|기가|만원)/.test(q)) return "알뜰폰과 유심 개통 상담이 가능합니다. 온라인 전용 요금제처럼 매장에서 취급하지 않는 상품도 있으니 데이터 사용량과 월 예산을 알려주시면 현재 취급 가능한 범위에서 먼저 비교해드릴게요.";
  if (/(인터넷|티비|tv|와이파이)/.test(q)) return "인터넷·TV 신규가입, 이전설치, 재약정 상담이 가능합니다. 현재 이용 통신사와 원하는 인터넷 속도, TV 대수 정도만 알려주시면 사이트에서 비교할 조건부터 잡아드릴게요.";
  if (/(정수기|렌탈|가전)/.test(q)) return "정수기와 생활가전 렌탈 상담이 가능합니다. 원하는 제품 종류를 알려주시면 먼저 확인할 항목을 안내하고, 시점별 렌탈료와 프로모션은 최종 상담에서 확인해드립니다.";
  if (/(중고폰|중고 폰|매입|팔고|판매)/.test(q)) return "중고폰 매입 상담이 가능합니다. 모델명과 기기 상태를 알려주시면 확인해야 할 부분부터 안내해드리고, 최종 매입가는 실제 기기 상태 확인 후 결정됩니다.";
  return "";
}

function answerCurrentCondition(context, history) {
  const details = [context.selection, context.summary, context.details].filter(Boolean).join(" · ").replace(/\s+/g, " ").slice(0, 900);
  if (details && !/^[-— ]+$/.test(details)) {
    return `지금 화면에서 선택하신 조건은 ${details}로 보여요. 이 조건이 ‘좋은지’는 사용량과 예산에 따라 달라지지만, 화면에 표시된 금액·데이터 조건까지는 바로 같이 판단할 수 있습니다. 평소 한 달 데이터 사용량이 대략 몇 GB인지 알려주시면 현재 조건이 과한지, 적당한지, 부족한지부터 짚어드릴게요.`;
  }
  const recent = history.slice(-4).map(x => x.content).join(" ");
  if (/\d[\d,]*원|\d+(?:\.\d+)?\s*(?:gb|g|기가)|요금제/i.test(recent)) {
    return "방금 이야기한 조건을 기준으로 이어서 볼게요. 월요금 자체만으로 좋고 나쁨을 단정하기보다 데이터 사용량과 통화량이 맞는지가 중요해요. 평소 한 달 데이터 사용량만 알려주시면 그 조건이 적당한지 바로 판단해드릴게요.";
  }
  return "좋은 조건인지 바로 같이 봐드릴 수 있어요. 다만 지금 화면에서는 어떤 요금제나 견적을 말씀하시는지 선택값이 보이지 않아서, ‘월 18,000원 / 데이터 7GB’처럼 월요금과 데이터 중 하나만 적어주세요. 그러면 그 조건이 어떤 사용 패턴에 맞는지 바로 설명해드릴게요.";
}

async function answerFromPublicCatalog(question, context = {}) {
  const q = question.toLowerCase().replace(/\s+/g, " ");
  const wantsPlan = /(요금제|얼마|가격|추천|데이터|gb|기가|만원|천원)/.test(q);
  if (!wantsPlan) return "";
  if (/(선불|모빙|프리티)/.test(q) || context.active_tab === "prepaid") {
    const data = await fetchJson(`${SITE}/data/prepaid.json?v=20260917`);
    return catalogReply(q, data, "선불폰");
  }
  if (/(알뜰|mvno|후불 유심|유심 요금)/.test(q) || context.active_tab === "mvno") {
    const data = await fetchJson(`${SITE}/data/mvno-postpaid.json?v=20260917`);
    return catalogReply(q, data, "알뜰폰");
  }
  return "";
}

async function fetchJson(url) {
  const r = await withTimeout(fetch(url, { headers: { "Accept": "application/json" } }), 2500);
  if (!r.ok) throw new Error(`catalog ${r.status}`);
  return r.json();
}

function catalogReply(q, data, label) {
  const providers = new Map((data?.providers || []).map(p => [p.id, p]));
  let rows = (data?.plans || []).slice();
  if (!rows.length) return "";
  if (q.includes("모빙")) rows = rows.filter(p => String(providers.get(p.provider_id)?.name || "").includes("모빙"));
  if (q.includes("프리티")) rows = rows.filter(p => String(providers.get(p.provider_id)?.name || "").includes("프리티"));
  if (/skt|sk망|skt망/.test(q)) rows = rows.filter(p => p.network === "SKT");
  else if (/(lgu\+|lg유플|lg망|u\+망)/.test(q)) rows = rows.filter(p => p.network === "LGU+");
  else if (/(^|\s)kt(망|\s|$)/.test(q)) rows = rows.filter(p => p.network === "KT");

  const band = q.match(/(\d+)\s*만원대/);
  const under = q.match(/(\d+)\s*만원\s*(?:이하|안쪽|미만)/);
  if (band) { const n = Number(band[1]) * 10000; rows = rows.filter(p => planFee(p) >= n && planFee(p) < n + 10000); }
  else if (under) { const n = Number(under[1]) * 10000; rows = rows.filter(p => planFee(p) <= n); }

  const gb = q.match(/(\d+(?:\.\d+)?)\s*(?:gb|기가|g)(?:\b|대|정도)/i);
  if (gb) {
    const needle = Number(gb[1]);
    rows = rows.filter(p => { const value = firstGb(p.data); return value !== null && value >= Math.max(0, needle - 0.5); });
  }

  if (!band && !under && !gb && /(추천|뭐가|어떤|괜찮)/.test(q)) return "정확히 추천하려면 데이터 사용량이나 월 예산 중 하나가 필요해요. 예를 들어 ‘선불 3만원대’, ‘알뜰폰 7GB 정도’처럼 말씀해주시면 현재 등록된 요금제에서 바로 추려드릴게요.";
  rows.sort((a,b) => planFee(a) - planFee(b));
  if (!rows.length) return `현재 등록된 ${label} 요금제에서는 말씀하신 조건과 정확히 맞는 항목을 찾지 못했어요. 예산이나 데이터 조건을 조금 넓혀주시면 다시 찾아볼게요.`;
  const picks = rows.slice(0, 4).map(p => {
    const provider = providers.get(p.provider_id);
    return `${provider?.name || p.provider_id} ${p.name} · ${won(planFee(p))}${p.data ? ` · 데이터 ${p.data}` : ""}${p.voice ? ` · 통화 ${p.voice}` : ""}`;
  });
  return `현재 사이트에 등록된 ${label} 요금제 중 조건에 가까운 항목은 ${picks.join(" / ")}입니다. 실제 개통 가능 여부와 프로모션은 상담 시점에 최종 확인해드릴게요.`;
}

function planFee(p) { const v = p?.special_monthly_fee ?? p?.monthly_fee; return Number.isFinite(Number(v)) ? Number(v) : Infinity; }
function firstGb(text) { const m = String(text || "").match(/(\d+(?:\.\d+)?)\s*GB/i); return m ? Number(m[1]) : null; }
function won(n) { return Number.isFinite(Number(n)) ? Math.round(Number(n)).toLocaleString("ko-KR") + "원" : "매장 확인"; }
function fallbackAnswer(question, context) {
  if (context.selection) return `현재 화면의 선택 조건은 ${context.selection}으로 확인됩니다. 궁금하신 부분이 월요금인지, 데이터가 충분한지, 다른 요금제와 비교인지 한 가지만 말씀해주시면 그 기준으로 이어서 안내해드릴게요.`;
  if (/(휴대폰|요금|알뜰|선불|인터넷|tv|티비|렌탈|중고폰)/i.test(question)) return "질문하신 내용은 도와드릴 수 있어요. 원하는 월 예산이나 사용량처럼 기준 하나만 더 알려주시면 확인 가능한 정보부터 바로 좁혀서 안내해드릴게요.";
  return "매장 이용과 휴대폰·요금제·알뜰폰·선불폰·인터넷·TV·렌탈 관련 질문을 도와드릴게요.";
}
function withTimeout(promise, ms) { return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]); }
function extractAnswer(result) {
  const candidates = [result?.response, result?.result?.response, result?.choices?.[0]?.message?.content, result?.choices?.[0]?.text, result?.output_text];
  for (const value of candidates) if (typeof value === "string" && value.trim()) return value.trim();
  const content = result?.choices?.[0]?.message?.content;
  if (Array.isArray(content)) { const text = content.map(item => typeof item === "string" ? item : item?.text || item?.content || "").join("").trim(); if (text) return text; }
  return "";
}
function json(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json; charset=UTF-8", "Cache-Control": "no-store" } });
}
