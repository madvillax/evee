import { defineAgent } from "eve";
import { model } from "../../lib/model";
export default defineAgent({ description: "Read or explicitly change monitoring and scoring preferences.", model, defaultTools: false });
