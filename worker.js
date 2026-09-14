// Git-connected Cloudflare Worker for Woongbi AI
export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "https://woongbts.github.io",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return json({ error: "POST 요청만 사용할 수 있습니다." }, 405, corsHeaders);
    }

    let question = "";
    try {
      const body = await request.json();
      question = String(body?.question || "").trim().slice(0, 400);
    } catch {
      return json({ error: "질문 형식을 확인해주세요." }, 400, corsHeaders);
    }

    if (!question) {
      return json({ error: "질문을 입력해주세요." }, 400, corsHeaders);
    }

    // 자주 묻는 매장 질문은 AI 호출 없이 즉시 답변합니다.
    // 무료 사용량을 아끼고, AI 모델이 일시적으로 불안정해도 기본 안내는 계속 동작합니다.
    const faqAnswer = answerKnownQuestion(question);
    if (faqAnswer) {
      return json({ answer: faqAnswer, source: "store-faq" }, 200, corsHeaders);
    }

    const systemPrompt = `너는 부산 북구 만덕동 '웅비통신 덕천만덕점'의 AI 안내 도우미다.

매장 정보:
- 상호명: 웅비통신 덕천만덕점
- 주소: 부산광역시 북구 만덕대로178번길 17
- 전화: 051-343-7677
- 영업시간: 월요일~토요일 오전 11시~오후 8시
- 매주 일요일 휴무
- 통신업 경력 16년
- 현 위치 7년째 운영
- 취급: 휴대폰, 알뜰폰, 선불폰, 인터넷·TV, 중고폰 매입, 정수기·생활가전 렌탈
- iPhone 18 사전예약 기간: 2026년 9월 12일 오후 9시 ~ 9월 17일

응답 규칙:
1. 한국어로 친절하고 이해하기 쉽게 답한다.
2. 일반적인 답변은 2~4문장 정도로 짧게 한다.
3. 확인되지 않은 가격, 지원금, 할인금액, 재고, 사은품, 개통 가능 여부는 절대 만들어내지 않는다.
4. 실시간 가격·지원금·재고·통신사별 조건은 매장 전화 051-343-7677 또는 카카오톡 상담을 안내한다.
5. 온라인 전용 알뜰폰 요금제처럼 매장에서 취급하지 않는 상품이 있을 수 있다고 안내한다.
6. 매장 정보와 무관한 질문이면 '매장 이용과 관련된 질문을 도와드릴게요.'라고 짧게 안내한다.
7. 모르는 내용은 추측하지 않는다.
8. 개인정보, 신분증 정보, 계좌번호, 비밀번호 등을 입력하라고 요구하지 않는다.`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: question },
    ];

    const models = [
      "@cf/zai-org/glm-4.7-flash",
      "@cf/google/gemma-4-26b-a4b-it",
    ];

    for (const model of models) {
      try {
        const options = {
          messages,
          max_completion_tokens: 220,
          temperature: 0.3,
        };
        if (model.includes("gemma")) {
          options.chat_template_kwargs = { enable_thinking: false };
        }

        const result = await env.AI.run(model, options);
        const answer = extractAnswer(result);
        if (answer) {
          return json({ answer, source: model }, 200, corsHeaders);
        }
        console.log("Unexpected Workers AI response shape", model, JSON.stringify(result));
      } catch (error) {
        console.log("Workers AI model error", model, String(error?.stack || error));
      }
    }

    return json({
      answer: "지금 AI 답변 연결이 잠시 원활하지 않습니다. 영업시간·위치·취급상품은 위 빠른 질문으로 확인할 수 있고, 가격·재고·지원금은 전화 051-343-7677 또는 카카오톡으로 문의해주세요.",
      source: "fallback",
    }, 200, corsHeaders);
  },
};

function answerKnownQuestion(question) {
  const q = question.toLowerCase().replace(/\s+/g, " ");

  if (hasAny(q, ["오늘 영업", "오늘 열", "오늘 문", "영업시간", "몇 시", "몇시", "일요일", "휴무"])) {
    const weekday = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      weekday: "long",
    }).format(new Date());
    if (weekday === "일요일") {
      return "오늘은 일요일이라 정기휴무입니다. 웅비통신 덕천만덕점은 월요일~토요일 오전 11시부터 오후 8시까지 영업합니다.";
    }
    return `오늘(${weekday})은 정상 영업일입니다. 웅비통신 덕천만덕점은 월요일~토요일 오전 11시부터 오후 8시까지 영업하고, 일요일은 휴무입니다.`;
  }

  if (hasAny(q, ["위치", "주소", "어디", "찾아가", "남산정역"])) {
    return "웅비통신 덕천만덕점은 부산광역시 북구 만덕대로178번길 17에 있습니다. 남산정역 3번 출구에서 도보 약 1분 거리입니다.";
  }

  if (hasAny(q, ["알뜰폰", "알뜰 폰"])) {
    return "네, 알뜰폰 상담과 개통이 가능합니다. 다만 일부 온라인 다이렉트 전용 요금제는 매장에서 취급하지 않을 수 있어 원하는 조건을 말씀해주시면 가능한 범위를 안내해드립니다.";
  }

  if (hasAny(q, ["선불폰", "선불 폰"])) {
    return "네, 선불폰 상담이 가능합니다. 개통 가능 여부와 준비사항은 상황에 따라 달라질 수 있으니 방문 전 전화 051-343-7677로 확인해주시면 가장 정확합니다.";
  }

  if (hasAny(q, ["인터넷", "tv", "티비", "와이파이"])) {
    return "네, 인터넷·TV 신규가입, 이전설치, 재약정 관련 상담이 가능합니다. 현재 이용 중인 통신사와 약정 상황을 알려주시면 확인이 더 수월합니다.";
  }

  if (hasAny(q, ["정수기", "렌탈", "가전"])) {
    return "네, 정수기와 생활가전 렌탈 상담이 가능합니다. 제품과 조건은 시점에 따라 달라질 수 있어 원하는 품목을 알려주시면 확인해드립니다.";
  }

  if (hasAny(q, ["중고폰", "중고 폰", "매입", "팔고 싶", "팔고싶"])) {
    return "네, 중고폰 매입 상담이 가능합니다. 기기 상태에 따라 금액이 달라지므로 사용하던 휴대폰을 가져오시면 확인 후 안내해드립니다.";
  }

  if (hasAny(q, ["아이폰18", "iphone 18", "사전예약"])) {
    return "iPhone 18 사전예약은 2026년 9월 12일 오후 9시부터 9월 17일까지 진행합니다. 정확한 기종별 조건과 재고는 매장으로 문의해주세요.";
  }

  if (hasAny(q, ["전화", "연락처", "번호", "카카오", "카톡"])) {
    return "웅비통신 덕천만덕점 전화번호는 051-343-7677입니다. 홈페이지의 카카오톡 버튼으로도 문의하실 수 있습니다.";
  }

  return "";
}

function hasAny(text, words) {
  return words.some((word) => text.includes(word));
}

function extractAnswer(result) {
  const candidates = [
    result?.response,
    result?.result?.response,
    result?.choices?.[0]?.message?.content,
    result?.choices?.[0]?.text,
    result?.output_text,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  const content = result?.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    const text = content
      .map((item) => (typeof item === "string" ? item : item?.text || item?.content || ""))
      .join("")
      .trim();
    if (text) return text;
  }

  return "";
}

function json(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store",
    },
  });
}
