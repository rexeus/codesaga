// Tests only: facts of one file from a source text, with the real parser, and facts with chosen counts.
import { fileFactsOf } from "../typescript/file-facts.js";
import type { FileFacts } from "../typescript/file-facts.js";
import { parseOptionsOf } from "../typescript/source-kinds.js";
import type { TypeSafetyFacts } from "../typescript/type-safety/type-safety-facts.js";
import { oxcParse } from "./oxc-parser.js";

/** The facts of `text` read as the file at `path`. */
export const factsOfText = (path: string, text: string): FileFacts =>
  fileFactsOf(oxcParse(path, text, parseOptionsOf(path)));

/** Facts that count nothing, except what `counts` says. */
export const factsWith = (counts: {
  readonly typeSafety?: Partial<TypeSafetyFacts>;
}): FileFacts => ({
  ...factsOfText("empty.ts", ""),
  typeSafety: {
    ...factsOfText("empty.ts", "").typeSafety,
    ...counts.typeSafety,
  },
});
