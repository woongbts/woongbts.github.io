// Public shell for Woongbi AI. Business prompt and answer logic live in the private AI core.
export default {
  async fetch(request, env) {
    if (!env.AI_CORE || typeof env.AI_CORE.fetch !== "function") {
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json; charset=UTF-8", "Cache-Control": "no-store" },
      });
    }
    return env.AI_CORE.fetch(request);
  },
};
