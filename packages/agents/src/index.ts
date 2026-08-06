import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";
import { client } from "@evee/platform/db/client";
import {
  draftingSpecialist,
  eveeCoordinatorAgent,
  intelligenceSpecialist,
  monitoringSpecialist,
  notificationSpecialist,
} from "./agents";
import { dailyDigestWorkflow, monitorAllWorkflow } from "./workflows";

// Only the dedicated worker may initialize Mastra's tables. Web requests use
// the same storage with implicit initialization disabled, so a user request
// can never issue schema DDL against the shared Turso database.
export const mastraStorage = new LibSQLStore({
  id: "evee-mastra",
  client,
  disableInit: true,
});

export const mastra = new Mastra({
  agents: {
    "evee-gtm-copilot": eveeCoordinatorAgent,
    "evee-intelligence-specialist": intelligenceSpecialist,
    "evee-monitoring-specialist": monitoringSpecialist,
    "evee-notification-specialist": notificationSpecialist,
    "evee-drafting-specialist": draftingSpecialist,
  },
  workflows: {
    "schedule-opportunity-monitoring": monitorAllWorkflow,
    "schedule-daily-telegram-digests": dailyDigestWorkflow,
  },
  storage: mastraStorage,
  // A web server only serves requests; it never runs schedules. The standalone
  // worker sets MASTRA_WORKER=true before importing this package.
  ...(process.env.MASTRA_WORKER === "true" ? {} : { workers: false }),
});

export { createEveeRequestContext } from "./context";
export { eveeCoordinatorAgent } from "./agents";
