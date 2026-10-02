// Owns the achievements line of the `analyze` view: how many are reached and which, by title.
// Titles are fixed words of the engine; they pass terminal-safe escaping all the same.
import type { Report } from "@codesaga/engine";

import { escapeForTerminal } from "../escape.js";
import { section } from "./layout.js";
import type { Style } from "./style.js";

const SEPARATOR = " · ";

/** One line: the reached count of the total, then the reached achievements in report order. */
export const achievementLines = (
  { achievements }: Report,
  style: Style,
): ReadonlyArray<string> => {
  const reached = achievements.filter((achievement) => achievement.reached);
  return section(
    "Achievements",
    [
      [
        `${reached.length} of ${achievements.length}`,
        ...reached.map(({ title }) => escapeForTerminal(title)),
      ].join(SEPARATOR),
    ],
    style,
  );
};
