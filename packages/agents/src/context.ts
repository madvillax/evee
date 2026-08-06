import { RequestContext } from "@mastra/core/request-context";
import { z } from "zod";

export const eveeRequestContextSchema = z.object({
  runtimeUserId: z.string().uuid(),
});

export function createEveeRequestContext(runtimeUserId: string) {
  return new RequestContext([["runtimeUserId", runtimeUserId]]);
}

export function getRuntimeUserId(context: { requestContext: { get: (key: "runtimeUserId") => string | undefined } }) {
  const userId = context.requestContext.get("runtimeUserId");
  if (!userId) throw new Error("A signed-in workspace is required.");
  return userId;
}
