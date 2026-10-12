import { defineAgent } from "eve";
import { model } from "../../lib/model";
export default defineAgent({ description: "Record explicit opportunity feedback and rewrite reply drafts.", model, defaultTools: false });
