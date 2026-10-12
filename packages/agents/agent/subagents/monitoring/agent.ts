import { defineAgent } from "eve";
import { model } from "../../lib/model";
export default defineAgent({ description: "Create focused source monitors and run requested scans.", model, defaultTools: false });
