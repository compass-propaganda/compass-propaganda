// SPDX-License-Identifier: MIT
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

const catalog = JSON.parse(await readFile(new URL("../.wrangler/recommendations.json", import.meta.url), "utf8"));
const id = Object.keys(catalog)[0];
const origin = "https://compass-propaganda.github.io";
const body = (value, note) => ({ visitor: "a".repeat(32), revision: catalog[id], value, ...(note === undefined ? {} : { note }) });
async function setup(t, limit = 60) {
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true,
    script: await readFile(new URL("../../dist/feedback/worker.js", import.meta.url), "utf8"),
    compatibilityDate: "2026-09-06",
    bindings: { ALLOWED_ORIGINS: origin },
    d1Databases: ["DB"],
    ratelimits: { RATE_LIMITER: { namespace_id: "1", simple: { limit, period: 60 } } },
  }));
  t.after(() => mf.dispose());
  const db = await mf.getD1Database("DB");
  const migration = await readFile(new URL("../migrations/0001_votes.sql", import.meta.url), "utf8");
  await db.exec(migration.replace(/^--.*$/gm, "").replace(/\n/g, " "));
  const send = (data, headers = {}, target = id) => mf.dispatchFetch(`https://feedback.example/recommendations/${target}`, {
    method: data === undefined ? "GET" : "POST",
    headers: { Origin: origin, "CF-Connecting-IP": "192.0.2.1", ...(data === undefined ? {} : { "Content-Type": "application/json" }), ...headers },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  return { mf, db, send };
}

test("repeat voting is idempotent; changing and withdrawing also update the private note correctly", async (t) => {
  const { db, send } = await setup(t);
  assert.deepEqual(await (await send()).json(), { agree: 0, disagree: 0 });
  for (let attempt = 0; attempt < 2; attempt++)
    assert.deepEqual(await (await send(body(1))).json(), { agree: 1, disagree: 0, value: 1 });
  const note = "<script>사적인 이유</script>";
  const submitted = await send(body(1, note));
  assert.equal(submitted.status, 200);
  assert.doesNotMatch(await submitted.text(), /사적인|visitor|revision|note/);
  await send(body(-1));
  assert.deepEqual(await (await send()).json(), { agree: 0, disagree: 1 });
  const stored = await db.prepare("SELECT * FROM votes").first();
  assert.equal(stored.note, note);
  assert.notEqual(stored.visitor, body(1).visitor);
  await send(body(-1, ""));
  assert.equal((await db.prepare("SELECT note FROM votes").first()).note, "");
  await db.prepare("UPDATE votes SET revision = ?, note = ?").bind("0".repeat(64), "이전 판본의 메모").run();
  await send(body(-1));
  const revised = await db.prepare("SELECT revision, note FROM votes").first();
  assert.equal(revised.revision, catalog[id]);
  assert.equal(revised.note, "");
  await send(body(0));
  assert.deepEqual(await (await send()).json(), { agree: 0, disagree: 0 });
  assert.equal(await db.prepare("SELECT * FROM votes").first(), null);
});
test("concurrent votes do not create duplicates or lose other visitors' votes", async (t) => {
  const { send } = await setup(t);
  await Promise.all(Array.from({ length: 8 }, () => send(body(1))));
  await Promise.all(Array.from({ length: 8 }, (_, i) => send({ ...body(-1), visitor: (i + 1).toString(16).padStart(32, "0") })));
  assert.deepEqual(await (await send()).json(), { agree: 1, disagree: 8 });
});
test("rejects untrusted origins, old editions, unknown recommendations and invalid input without writes", async (t) => {
  const { mf, db, send } = await setup(t);
  assert.equal((await send(body(1), { Origin: "https://other.example" })).status, 403);
  assert.equal((await send(body(1), {}, "999999")).status, 404);
  assert.equal((await send({ ...body(1), revision: "0".repeat(64) })).status, 409);
  for (const invalid of [{ ...body(1), value: 2 }, { ...body(1), note: "x".repeat(501) }, { ...body(1), visitor: [] }, { ...body(1), extra: true }])
    assert.equal((await send(invalid)).status, 400);
  assert.equal((await send(body(1), { "Content-Type": "text/plain" })).status, 415);
  assert.equal((await send({ ...body(1), note: "x".repeat(5000) })).status, 413);
  const invalidJson = await mf.dispatchFetch(`https://feedback.example/recommendations/${id}`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "{" });
  assert.equal(invalidJson.status, 400);
  assert.equal(await db.prepare("SELECT * FROM votes").first(), null);
  const preflight = await mf.dispatchFetch(`https://feedback.example/recommendations/${id}`, { method: "OPTIONS", headers: { Origin: origin } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), origin);
});
test("rate limits and database failures do not pretend the reaction was saved", async (t) => {
  const { db, send } = await setup(t, 1);
  assert.equal((await send(body(1))).status, 200);
  assert.equal((await send(body(-1))).status, 429);
  await db.exec("DROP TABLE votes");
  const response = await send(body(1), { "CF-Connecting-IP": "192.0.2.2" });
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /SQL|stack|D1_ERROR|no such table/);
});
