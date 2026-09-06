// SPDX-License-Identifier: MIT
import assert from "node:assert/strict";
import { test } from "node:test";
import MarkdownIt from "markdown-it";
import { renderOracleSetup } from "./setup-oracle.mjs";

const prompts = {
  install: "Install the oracle.",
  setup: "Keep these instructions.",
  start: "Start the conversation.",
  "other-start": "Install if possible; otherwise use the supplied document.",
};

test("chat copy preserves the entire supplied bundle, including HTML-like text, in one shared source", () => {
  const escape = new MarkdownIt().utils.escapeHtml;
  const bundle =
    '# Oracle\n\n<script>test & "quotes"</script>\n\n## Last document\nComplete.\n';
  const html = renderOracleSetup(prompts, bundle, escape);
  const sources = [
    ...html.matchAll(/<code id="oracle-full-prompt">([\s\S]*?)<\/code>/g),
  ];
  assert.equal(sources.length, 1);
  assert.equal(sources[0][1], escape(`${bundle}\n\n---\n\n${prompts.start}`));
  assert(!html.includes("<script>"));
  assert.equal((html.match(/data-copy="oracle-full-prompt"/g) || []).length, 3);
  const other = html.match(
    /<code id="oracle-other-prompt">([\s\S]*?)<\/code>/,
  )[1];
  assert.equal(other, escape(`${bundle}\n\n---\n\n${prompts["other-start"]}`));
  const otherPanel = html.match(
    /<section[^>]+id="other">([\s\S]*?)<\/section>/,
  )[1];
  assert(otherPanel.includes('data-copy="oracle-other-prompt"'));
  assert(!otherPanel.includes('data-copy="oracle-full-prompt"'));
});

test("each service and copy action has a unique reachable target before JavaScript runs", () => {
  const html = renderOracleSetup(
    prompts,
    "Oracle.",
    new MarkdownIt().utils.escapeHtml,
  );
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const [, target] of html.matchAll(/(?:data-copy="|href="#)([^"]+)"/g)) {
    assert(ids.includes(target), `Missing target: ${target}`);
  }
  assert.equal((html.match(/class="oracle-panel prose"/g) || []).length, 7);
  assert(!html.includes(" hidden"));
});
