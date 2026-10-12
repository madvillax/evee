import { defineSandbox } from "eve/sandbox";
import { JustBashSandbox } from "eve/sandbox/just-bash";

// This agent uses typed application tools only. Keep local workspace storage
// lightweight and portable; shell and file tools are disabled in agent.ts.
export const environment = JustBashSandbox.environment({ autoInstall: false });
export default defineSandbox(() => environment.open());
