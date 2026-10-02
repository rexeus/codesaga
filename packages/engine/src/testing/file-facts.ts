// Tests only: facts of one file from a source text, with the real parser, and facts with chosen counts.
import type { EcosystemFacts } from "../typescript/ecosystem/hook-facts.js";
import { fileFactsOf } from "../typescript/file-facts.js";
import type { FileFacts } from "../typescript/file-facts.js";
import type { IdiomFacts } from "../typescript/idioms/idiom-facts.js";
import type { ModuleFacts } from "../typescript/modules/module-facts.js";
import { parseOptionsOf } from "../typescript/source-kinds.js";
import type { TypeSafetyFacts } from "../typescript/type-safety/type-safety-facts.js";
import { oxcParse } from "./oxc-parser.js";

/** The facts of `text` read as the file at `path`. */
export const factsOfText = (path: string, text: string): FileFacts =>
  fileFactsOf(oxcParse(path, text, parseOptionsOf(path)));

/** Facts that count nothing, except what `counts` says. */
export const factsWith = (counts: {
  readonly typeSafety?: Partial<TypeSafetyFacts>;
  readonly modules?: Partial<ModuleFacts>;
  readonly idioms?: Partial<IdiomFacts>;
  readonly ecosystem?: Partial<EcosystemFacts>;
}): FileFacts => {
  const empty = factsOfText("empty.ts", "");
  return {
    ...empty,
    typeSafety: { ...empty.typeSafety, ...counts.typeSafety },
    modules: { ...empty.modules, ...counts.modules },
    idioms: { ...empty.idioms, ...counts.idioms },
    ecosystem: { ...empty.ecosystem, ...counts.ecosystem },
  };
};
