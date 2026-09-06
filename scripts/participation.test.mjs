// SPDX-License-Identifier: MIT
import test from "node:test";
import assert from "node:assert/strict";
import { validateIntegrations, renderFeedback, renderVoteSummary, renderSubscription } from "./participation.mjs";

test("public integrations require HTTPS and a provider-owned subscription endpoint", () => {
  validateIntegrations({ feedback_url: "https://feedback.example", follow_it_action: "https://api.follow.it/subscription-form/test" });
  validateIntegrations({ feedback_url: "http://127.0.0.1:8787" }, true);
  for (const feedback_url of ["http://127.0.0.1:8787", "https://user:pass@feedback.example", "https://feedback.example/path", "https://feedback.example/?token=private"])
    assert.throws(() => validateIntegrations({ feedback_url }));
  for (const follow_it_action of ["https://other.example/subscribe", "http://api.follow.it/subscribe", "https://api.follow.it.other.example/subscribe"])
    assert.throws(() => validateIntegrations({ follow_it_action }));
});

test("unconfigured services and non-current recommendations do not expose inactive forms", () => {
  assert.equal(renderSubscription("", String), "");
  assert.equal(renderFeedback({ effect: "현행" }, "source", "", String), "");
  assert.equal(renderFeedback({ effect: "철회" }, "source", "https://feedback.example", String), "");
  const markup = renderFeedback({ effect: "현행", number: 1 }, "source", "https://feedback.example", String);
  assert.match(markup, /data-recommendation="1"/);
  assert.match(markup, /data-revision="[a-f0-9]{64}"/);
  assert.match(markup, /<form[^>]* hidden>/);
  assert.equal(renderVoteSummary({ effect: "현행" }, "", String), "");
  assert.equal(renderVoteSummary({ effect: "철회" }, "https://feedback.example", String), "");
  const summary = renderVoteSummary({ effect: "현행", number: 1 }, "https://feedback.example", String);
  assert.match(summary, /data-feedback-summary=/);
  assert.doesNotMatch(summary, /<button|<form|data-feedback=/);
});
