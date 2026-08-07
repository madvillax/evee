import { expect, test } from "bun:test";
import { cleanText, escapeHtml, splitCommaList } from "../src/utils/text";

test("normalizes public source text", () => {
  expect(cleanText("<p>Hello &amp; welcome</p>\n\nworld")).toBe("Hello & welcome world");
});

test("escapes channel message HTML", () => {
  expect(escapeHtml('<script a="1">&')).toBe("&lt;script a=&quot;1&quot;&gt;&amp;");
});

test("parses onboarding lists", () => {
  expect(splitCommaList("founders, support teams\n agencies")).toEqual(["founders", "support teams", "agencies"]);
});
