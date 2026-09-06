import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { candidatePrefilter, heuristicAnalysis } from "../src/ai/analyzer";
import type { Candidate, Profile } from "../src/domain/types";

const profile: Profile = {
  id: "profile-1",
  userId: "user-1",
  productName: "QueueFox",
  productSummary: "A support queue that helps small SaaS teams triage customer conversations automatically.",
  targetCustomers: ["small SaaS support teams"],
  painPoints: ["support triage", "slow customer replies"],
  competitors: ["Zendesk"],
  replyStyle: "concise, friendly, and practical",
  keywords: ["support queue", "ticket triage"],
  exclusions: ["job posting"],
  version: 1,
  createdAt: 1,
  updatedAt: 1,
};

const candidate: Candidate = {
  source: "reddit",
  externalId: "abc",
  url: "https://reddit.com/r/saas/abc",
  title: "Looking for an alternative to Zendesk for support triage",
  body: "Our small SaaS support team is struggling with slow customer replies. Any recommendations?",
  author: "founder",
  publishedAt: Date.now(),
  metadata: {},
};

describe("opportunity heuristic", () => {
  test("prioritizes explicit solution-seeking with strong product fit", () => {
    assert.ok(candidatePrefilter(candidate, profile) > 5);
    const result = heuristicAnalysis(candidate, profile);
    assert.equal(result.relevant, true);
    assert.ok(result.score >= 65);
    assert.equal(result.signals.some((signal) => signal.includes("Zendesk")), true);
    assert.match(result.replyDraft, /I work on QueueFox/);
  });

  test("does not promote on a weak announcement", () => {
    const result = heuristicAnalysis({
      ...candidate,
      externalId: "weak",
      title: "Show HN: We launched a drawing app",
      body: "Here is our launch announcement.",
    }, profile);
    assert.equal(result.relevant, false);
    assert.equal(result.replyDraft, "");
  });

  test("score equals its documented components", () => {
    const result = heuristicAnalysis(candidate, profile);
    assert.equal(result.score,
      result.intentScore + result.fitScore + result.urgencyScore + result.specificityScore + result.replySafetyScore,
    );
  });
});
