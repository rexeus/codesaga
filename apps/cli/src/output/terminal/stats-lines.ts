// Owns the stats block of the `analyze` view: size, tests, file length, churn, complexity and style in three lines.
// Numbers only; no path or name from git appears here, so nothing needs escaping.
import type { Report } from "@codesaga/engine";

import { count, plural, share } from "./format.js";
import { section } from "./layout.js";
import type { Style } from "./style.js";

const SEPARATOR = " · ";

/** A number with at most one decimal: `3`, `2.5`. */
const figure = (value: number): string => count(Math.round(value * 10) / 10);

/** `2 spaces`, `tabs`, or `no indentation` when no line is indented. */
const indentation = ({ indent }: Report["stats"]["style"]): string => {
  if (indent.tabsShare === 0 && indent.spacesShare === 0) {
    return "no indentation";
  }
  return indent.tabsShare > indent.spacesShare
    ? "tabs"
    : plural(indent.width, "space");
};

/** The stats of the repository as a labelled block; one line without code files. */
export const statsLines = (
  { stats }: Report,
  style: Style,
): ReadonlyArray<string> => {
  if (stats.files === 0) {
    return section("Stats", ["no code files"], style);
  }
  return section(
    "Stats",
    [
      [
        plural(stats.files, "file"),
        plural(stats.codeLines, "line"),
        `${share(stats.tests.files, stats.files)} tests`,
      ].join(SEPARATOR),
      [
        `median file ${plural(Math.round(stats.fileLength.median), "line")}`,
        `${figure(stats.churn.median)} revisions per file`,
        `${stats.complexity.perLine.toFixed(2)} indentation levels per line`,
      ].join(SEPARATOR),
      [
        indentation(stats.style),
        `lines ${figure(stats.style.lineLength.median)} median, ${figure(stats.style.lineLength.p90)} p90`,
        `${share(stats.style.commentLines.lines, stats.codeLines)} comments`,
      ].join(SEPARATOR),
    ],
    style,
  );
};
