import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const claimsSchema = z.object({ authUserId: z.string().min(1), workspaceId: z.string().uuid(), expiresAt: z.number().int() });
function secret() {
  const key = process.env.EVE_SERVICE_SECRET;
  if (!key || key.length < 32) throw new Error("Set EVE_SERVICE_SECRET to a random secret of at least 32 characters in the API and Eve service.");
  return key;
}
export function signAgentCaller(authUserId: string, workspaceId: string) {
  const payload = Buffer.from(JSON.stringify({ authUserId, workspaceId, expiresAt: Date.now() + 300_000 })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}
export function verifyAgentCaller(token: string) {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts as [string, string];
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const supplied = Buffer.from(signature, "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const parsed = claimsSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString()));
    return parsed.success && parsed.data.expiresAt > Date.now() ? parsed.data : null;
  } catch { return null; }
}
