// Owns the `deepDives.typescript.achievements` list: the state achievements of the parsed files, and the ones that need the history when it was read.
// Apart from the deep dive so that it owns one decision: which achievements the section lists.

import type { TypeScriptDeepDive } from "../../report/typescript-deep-dive.js";
import type { Strictness } from "../../report/typescript-strictness.js";
import type { ParsedFile } from "../parsed-file.js";
import type { TrendInput } from "../trend-input.js";
import { stateAchievementsOf } from "./state-achievements.js";
import { tightened } from "./tightened.js";

/**
 * The list as the section carries it, or nothing without a production
 * TypeScript file. `history` adds the achievements that need the trends.
 */
export const achievementsOf = (
  parsed: ReadonlyArray<ParsedFile>,
  strictness: Strictness,
  history: TrendInput | undefined,
): Pick<TypeScriptDeepDive, "achievements"> => {
  const states = stateAchievementsOf(parsed, strictness);
  return states.length === 0
    ? {}
    : {
        achievements: [...states, ...tightened(history)],
      };
};
