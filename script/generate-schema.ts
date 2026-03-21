/**
 * generate-schema.ts
 *
 * Generates schema.json from the Zod ConfigSchema defined in src/config.ts.
 * Run via: npm run generate-schema
 *
 * Uses Zod v4's built-in toJSONSchema — no additional dependencies needed.
 * The schema is published to GitHub Pages on every push to main.
 * It is NOT committed to the repository (see .gitignore).
 */

import { writeFileSync } from "node:fs"
import { toJSONSchema } from "zod/v4"
import { ConfigSchema } from "../src/config.js"

const schema = toJSONSchema(ConfigSchema, {
  reused: "inline",
  target: "draft-7",
})

writeFileSync("schema.json", JSON.stringify(schema, null, 2) + "\n")
console.log("schema.json written")
