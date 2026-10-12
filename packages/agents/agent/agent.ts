import { defineAgent } from "eve";
import { model } from "./lib/model";

export default defineAgent({
  model,
  defaultTools: false,
  limits: { maxInputTokensPerSession: 200_000, maxOutputTokensPerSession: 20_000, sessionTimeoutMs: 7 * 24 * 60 * 60_000 },
});
