import { defineAgent } from "eve";
import { model } from "../../lib/model";
export default defineAgent({ description: "Read the saved business profile and current qualified opportunities.", model, defaultTools: false });
