import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { env } from "@evee/platform/config/env";

// Keep direct Gemini credentials shared with the structured analyzer.
export const model = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY ?? "" })(env.GEMINI_MODEL);
