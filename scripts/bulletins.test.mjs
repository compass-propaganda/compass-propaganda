// SPDX-License-Identifier: MIT
import test from "node:test";
import assert from "node:assert/strict";
import { parseBulletins, renderFeed } from "./bulletins.mjs";

const now = new Date("2026-09-06T12:00:00Z");
const post = (metadata = 'status: published\npublished_at: "2026-09-06T09:00:00+09:00"\nsummary: "새 소식 & 다음 걸음"', title = "소식을 전합니다") => `---\n${metadata}\n---\n# ${title}\n\n본문\n`;
test("only explicitly published bulletins enter the feed, newest first", () => {
  const entries = parseBulletins(new Map([
    ["bulletins/001-first.md", post()],
    ["bulletins/002-draft.md", post("status: draft")],
    ["bulletins/003-next.md", post().replace("09:00:00+09:00", "10:00:00+09:00")],
    ["recommendations/001-example.md", "unrelated"],
  ]), now);
  assert.deepEqual(entries.map((entry) => entry.number), [3, 1]);
  const feed = renderFeed(entries, "https://example.org/project/");
  assert.match(feed, /새 소식 &amp; 다음 걸음/);
  assert.match(feed, /https:\/\/example.org\/project\/bulletins\/001-first.html/);
  assert.doesNotMatch(feed, /draft|unrelated/);
  const renamed = entries.map((entry) => ({ ...entry, source: entry.source.replace("first", "renamed") }));
  assert.deepEqual([...feed.matchAll(/<guid[^>]*>(.*?)<\/guid>/g)].map((match) => match[1]), [...renderFeed(renamed, "https://example.org/project/").matchAll(/<guid[^>]*>(.*?)<\/guid>/g)].map((match) => match[1]));
});
test("ambiguous publication metadata fails instead of mailing a draft", () => {
  for (const metadata of ["status: publish", "status: published", 'status: published\npublished_at: "2026-02-30T09:00:00Z"', 'status: published\npublished_at: "2027-01-01T00:00:00Z"', "status: draft\nstatus: published", "status: draft\nunknown: value"]) {
    assert.throws(() => parseBulletins(new Map([["bulletins/001-test.md", post(metadata)]]), now));
  }
  assert.throws(() => parseBulletins(new Map([["bulletins/001-first.md", post()], ["bulletins/1-second.md", post()]]), now), /중복/);
});
test("an empty feed is stable and has no synthetic issue or build timestamp", () => {
  const feed = renderFeed([], "https://example.org/");
  assert.doesNotMatch(feed, /<item>|lastBuildDate/);
  assert.equal(feed, renderFeed([], "https://example.org/"));
});
