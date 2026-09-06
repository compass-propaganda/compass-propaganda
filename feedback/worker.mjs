// SPDX-License-Identifier: MIT
import recommendations from "./.wrangler/recommendations.json";

const securityHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Strict-Transport-Security": "max-age=31536000",
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const headers = { ...securityHeaders, Vary: "Origin" };
    const reply = (data, status = 200) => Response.json(data, { status, headers });
    if (!origin || !env.ALLOWED_ORIGINS.split(",").includes(origin))
      return reply({ error: "허용되지 않은 요청입니다." }, 403);
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
    const path = new URL(request.url).pathname.match(/^\/recommendations\/([1-9]\d*)$/);
    if (!path || !Object.hasOwn(recommendations, path[1]))
      return reply({ error: "현행 권장을 찾을 수 없습니다." }, 404);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (!["GET", "POST"].includes(request.method))
      return reply({ error: "지원하지 않는 요청입니다." }, 405);
    try {
      // IP is used only for the short-lived edge rate limit, never stored in D1.
      const { success } = await env.RATE_LIMITER.limit({ key: request.headers.get("CF-Connecting-IP") || "local" });
      if (!success) return reply({ error: "잠시 후 다시 시도해 주세요." }, 429);
      const recommendation = path[1];
      const count = env.DB.prepare("SELECT COALESCE(SUM(value = 1), 0) AS agree, COALESCE(SUM(value = -1), 0) AS disagree FROM votes WHERE recommendation = ?").bind(recommendation);
      if (request.method === "GET") return reply(await count.first());
      if (request.headers.get("Content-Type")?.split(";")[0].trim() !== "application/json")
        return reply({ error: "JSON 요청이 필요합니다." }, 415);
      if (Number(request.headers.get("Content-Length")) > 4096)
        return reply({ error: "메모가 너무 깁니다." }, 413);
      // Bound chunked bodies too; Content-Length is not an authority.
      const reader = request.body?.getReader();
      const chunks = [];
      let length = 0;
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > 4096) {
            await reader.cancel();
            return reply({ error: "메모가 너무 깁니다." }, 413);
          }
          chunks.push(value);
        }
      }
      let body;
      try { body = JSON.parse(await new Blob(chunks).text()); }
      catch { return reply({ error: "요청 내용을 확인해 주세요." }, 400); }
      if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => !["visitor", "revision", "value", "note"].includes(key)) || typeof body.visitor !== "string" || !/^[a-f0-9]{32}$/.test(body.visitor) || ![-1, 0, 1].includes(body.value) || (body.note !== undefined && (typeof body.note !== "string" || body.note.length > 500)))
        return reply({ error: "반응이나 메모를 확인해 주세요." }, 400);
      if (body.revision !== recommendations[recommendation])
        return reply({ error: "권장이 갱신되었습니다. 페이지를 새로 열어 주세요." }, 409);
      // Per-recommendation random browser IDs are stored only as hashes.
      const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${recommendation}:${body.visitor}`));
      const visitor = [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
      const change = body.value === 0
        ? env.DB.prepare("DELETE FROM votes WHERE recommendation = ? AND visitor = ?").bind(recommendation, visitor)
        : env.DB.prepare(`INSERT INTO votes (recommendation, visitor, revision, value, note) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (recommendation, visitor) DO UPDATE SET
              revision = excluded.revision, value = excluded.value,
              note = CASE WHEN ? THEN excluded.note WHEN votes.revision = excluded.revision THEN votes.note ELSE '' END,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`)
          .bind(recommendation, visitor, body.revision, body.value, body.note?.trim() || "", body.note !== undefined ? 1 : 0);
      const results = await env.DB.batch([change, count]);
      // Public responses never include a visitor ID or note, including the submitter's.
      return reply({ ...results[1].results[0], value: body.value });
    } catch {
      console.error(JSON.stringify({ event: "feedback_request_failed" }));
      return reply({ error: "반응을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 503);
    }
  },
};
