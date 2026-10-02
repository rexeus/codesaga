// Owns the style stats of a set of files: indentation, line length and comments.

import type { CodeStats } from "../report/code-stats.js";
import { roundReported } from "../report/precision.js";
import type { InventoryFile } from "../universe/inventory.js";
import { mergeIntegerTallies, percentiles } from "./distribution.js";
import { ratioOf } from "./measures.js";

/** The width most space-indented lines vote for; the smaller width wins a tie, 0 without votes. */
const winningWidth = (votes: ReadonlyMap<number, number>): number => {
  const [winner] = [...votes].toSorted(
    ([widthA, votesA], [widthB, votesB]) => votesB - votesA || widthA - widthB,
  );
  return winner?.[0] ?? 0;
};

/**
 * The style stats of `files`, without the commit habits that only the whole
 * repository has. `codeLines` is the set's non-blank lines. The indentation
 * width is the most common one, each file voting for its own width with its
 * space-indented lines.
 */
export const styleStats = (
  files: ReadonlyArray<InventoryFile>,
  codeLines: number,
): Omit<CodeStats["style"], "conventionalCommits" | "commitSize"> => {
  let tabs = 0;
  let spaces = 0;
  let comments = 0;
  const widthVotes = new Map<number, number>();
  for (const file of files) {
    tabs += file.tabIndented;
    spaces += file.spaceIndented;
    comments += file.commentLines;
    if (file.spaceIndented > 0) {
      widthVotes.set(
        file.indentWidth,
        (widthVotes.get(file.indentWidth) ?? 0) + file.spaceIndented,
      );
    }
  }
  const [median = 0, p90 = 0] = percentiles(
    mergeIntegerTallies(files.map(({ lineLengths }) => lineLengths)),
    [0.5, 0.9],
  );
  return {
    indent: {
      spacesShare: ratioOf(spaces, tabs + spaces),
      tabsShare: ratioOf(tabs, tabs + spaces),
      width: winningWidth(widthVotes),
    },
    lineLength: { median: roundReported(median), p90: roundReported(p90) },
    commentLines: { lines: comments, share: ratioOf(comments, codeLines) },
  };
};
