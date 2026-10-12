import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { signAgentCaller, verifyAgentCaller } from "../src/services/agent-auth";

test("agent service credentials reject tampering and expire", () => {
  const saved = process.env.EVE_SERVICE_SECRET;
  process.env.EVE_SERVICE_SECRET = "test-only-service-secret-at-least-32-characters";
  try {
    const workspaceId = crypto.randomUUID();
    const token = signAgentCaller("member-a", workspaceId);
    assert.equal(verifyAgentCaller(token)?.workspaceId, workspaceId);
    const [payload, signature] = token.split(".");
    const otherPayload = Buffer.from(JSON.stringify({ authUserId: "member-b", workspaceId, expiresAt: Date.now() + 60_000 })).toString("base64url");
    assert.equal(verifyAgentCaller(`${otherPayload}.${signature}`), null);
    assert.equal(verifyAgentCaller(`${payload}.bad-signature`), null);
    assert.equal(verifyAgentCaller("malformed"), null);
    const later = Date.now() + 300_001;
    mock.method(Date, "now", () => later);
    assert.equal(verifyAgentCaller(token), null);
    mock.restoreAll();
  } finally {
    if (saved === undefined) delete process.env.EVE_SERVICE_SECRET;
    else process.env.EVE_SERVICE_SECRET = saved;
  }
});
