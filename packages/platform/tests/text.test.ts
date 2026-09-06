import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanText, escapeHtml, splitCommaList } from "../src/utils/text";

test("normalizes public source text", () => {
  assert.equal(cleanText("<p>Hello &amp; welcome</p>\n\nworld"), "Hello & welcome world");
});

test("escapes rendered HTML", () => {
  assert.equal(escapeHtml('<script a="1">&'), "&lt;script a=&quot;1&quot;&gt;&amp;");
});

test("parses onboarding lists", () => {
  assert.deepEqual(splitCommaList("founders, support teams\n agencies"), ["founders", "support teams", "agencies"]);
});
