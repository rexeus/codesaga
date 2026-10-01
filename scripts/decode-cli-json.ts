/**
 * Decodes a command's `--json` document from stdin with the engine schema that
 * defines its contract: `tsx scripts/decode-cli-json.ts <analyze|inspect> < document.json`.
 * Exits 1 and prints the schema's explanation when the document does not decode.
 * The engine is private and bundled, so the package check and CI feed it the
 * output of the packed bundle and decode it against the workspace source.
 */
import { readFileSync } from "node:fs";

import { Schema } from "effect";

import { InspectResult, Report } from "../packages/engine/src/index.js";

const schemas = { analyze: Report, inspect: InspectResult };

const command = process.argv[2];
if (command !== "analyze" && command !== "inspect") {
  console.error("Usage: decode-cli-json.ts <analyze|inspect> < document.json");
  process.exit(2);
}

try {
  Schema.decodeUnknownSync(schemas[command])(
    JSON.parse(readFileSync(0, "utf8")),
  );
} catch (error) {
  console.error(`The ${command} --json document does not match its schema:`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
