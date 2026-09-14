// Git-connected Cloudflare Worker for Woongbi AI
export default {
  async fetch(request, env) {
    const allowedOrigin = "https://woongbts.github.io";
    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
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

    try {
      const body = await request.json();
      const question = String(body?.question || "").trim().slice(0, 400);

      if (!question) {
        return json({ error: "질문을 입력해주세요." }, 400, corsHeaders);
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

      const result = await env.AI.run("@cf/zai-org/glm-4.7-flash", {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
        max_completion_tokens: 220,
        temperature: 0.3,
      });

      const answer = extractAnswer(result);
      if (!answer) {
        console.log("Unexpected Workers AI response shape", JSON.stringify(result));
        return json({ error: "AI 답변 형식을 확인하지 못했습니다. 잠시 후 다시 시도해주세요." }, 502, corsHeaders);
      }

      return json({ answer }, 200, corsHeaders);
    } catch (error) {
      console.log("Workers AI error", String(error?.stack || error));
      return json({ error: "AI 응답 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." }, 500, corsHeaders);
    }
  },
};

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
