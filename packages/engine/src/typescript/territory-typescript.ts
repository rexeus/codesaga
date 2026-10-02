// Owns the compact TypeScript figures of one territory, from the parsed files it holds.

import type { TerritoryStrict } from "../report/typescript-strictness.js";
import type { TerritoryTypeScript } from "../report/typescript-territory.js";
import { sum } from "../stats/measures.js";
import type { ParsedFile } from "./parsed-file.js";
import { productionEscapesPer1000 } from "./type-safety/type-safety-report.js";

/** The territory's figures, with `strict` of its governed files, or undefined when it holds no parsed file. */
export const territoryTypeScriptOf = (
  files: ReadonlyArray<ParsedFile>,
  strict: TerritoryStrict | undefined,
): TerritoryTypeScript | undefined => {
  if (files.length === 0) {
    return undefined;
  }
  const escapesPer1000 = productionEscapesPer1000(files);
  return {
    files: files.length,
    codeLines: sum(files.map((file) => file.lines)),
    ...(escapesPer1000 === undefined ? {} : { escapesPer1000 }),
    ...(strict === undefined ? {} : { strict }),
  };
};
