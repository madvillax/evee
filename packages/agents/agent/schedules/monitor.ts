import { defineSchedule } from "eve/schedules";
import { monitorAllWorkspaces } from "../../src/workflows";

export default defineSchedule({
  cron: "*/20 * * * *",
  async run() { await monitorAllWorkspaces(); },
});
