import type { Report } from "@codesaga/engine";

import {
  formatShare,
  formatWhole,
  indentationOf,
  pathTail,
} from "./code-stats.js";
import type { CodeStats, Indentation } from "./code-stats.js";
import { formatCount, formatPercent } from "./format.js";
import type { IconName } from "./icons.js";
import { languageShares } from "./languages.js";
import type { LanguageShare } from "./languages.js";

/** A language row of the table: its color, lines and share. */
export type LanguageRow = LanguageShare & { readonly share: string };

/** The languages by lines, each with its share as the table words it (`<1%` for a sliver). */
export const languageRows = (
  languages: CodeStats["languages"],
  entityOf: (name: string) => string,
): LanguageRow[] => {
  const total = languages.reduce((sum, { lines }) => sum + lines, 0);
  return languageShares(
    languages.map(({ name, files, lines }) => ({ name, files, loc: lines })),
    entityOf,
  ).map((language) =>
    Object.assign(language, { share: formatShare(language.loc, total) }),
  );
};

/** The test files and lines against the rest, as two stacked bars. */
export type TestRow = {
  readonly label: string;
  readonly tests: number;
  readonly others: number;
  /** `45%`. */
  readonly share: string;
  /** `60 test · 74 other code`. */
  readonly caption: string;
};

const testRow = (label: string, testCount: number, whole: number): TestRow => ({
  label,
  tests: testCount,
  others: whole - testCount,
  share: formatShare(testCount, whole),
  caption: `${formatCount(testCount)} test · ${formatCount(whole - testCount)} other code`,
});

/** The files and the lines of the repository, each split into tests and the rest. */
export const testRows = ({ files, codeLines, tests }: CodeStats): TestRow[] => [
  testRow("Files", tests.files, files),
  testRow("Lines", tests.lines, codeLines),
];

/** A file of the most-changed list with its bar against the busiest one. */
export type ChangedFileRow = {
  readonly name: string;
  readonly path: string;
  readonly revisions: string;
  readonly fraction: number;
};

/** The most changed files, each with its revisions as a fraction of the first's. */
export const changedFileRows = ({ churn }: CodeStats): ChangedFileRow[] => {
  const most = Math.max(
    1,
    ...churn.mostChanged.map(({ revisions }) => revisions),
  );
  return churn.mostChanged.map(({ path, revisions }) => ({
    name: pathTail(path),
    path,
    revisions: formatCount(revisions),
    fraction: revisions / most,
  }));
};

/** One line of the style card. */
export type StyleRow = {
  readonly label: string;
  readonly icon: IconName;
  /** The strong lead of the line, then what follows in the muted ink. */
  readonly lead: string;
  readonly rest: string;
  /** A bar below the line: shares that fill it, or null for none. */
  readonly bar:
    | readonly { readonly entity: string; readonly share: number }[]
    | null;
};

type Style = CodeStats["style"];

const indentRow = (indentation: Indentation): StyleRow => ({
  label: "Indentation",
  icon: "indent-increase",
  lead: indentation.headline,
  rest: indentation.split === "" ? "" : ` · ${indentation.split}`,
  bar:
    indentation.split === ""
      ? null
      : [
          { entity: "slot-1", share: indentation.spacesShare },
          { entity: "slot-2", share: indentation.tabsShare },
        ],
});

const habitRows = (style: Style): StyleRow[] => {
  const { conventionalCommits, commitSize } = style;
  return [
    ...(conventionalCommits === undefined
      ? []
      : [
          {
            label: "Conventional Commits",
            icon: "git-commit-horizontal",
            lead: formatPercent(conventionalCommits.share),
            rest: ` of commits · ${formatCount(conventionalCommits.conventional)} of ${formatCount(conventionalCommits.commits)}`,
            bar: [{ entity: "slot-1", share: conventionalCommits.share }],
          } satisfies StyleRow,
        ]),
    ...(commitSize === undefined
      ? []
      : [
          {
            label: "Commit size",
            icon: "git-merge",
            lead: formatWhole(commitSize.median),
            rest: ` lines median · ${formatWhole(commitSize.p90)} p90, commits touching code`,
            bar: null,
          } satisfies StyleRow,
        ]),
  ];
};

/**
 * The style and habits of the repository: how it is indented, how long its
 * lines are, how much of it is comments, and, when the report has them, the
 * share of Conventional Commits and the size of a commit.
 */
export const styleRows = (stats: CodeStats): StyleRow[] => {
  const { style, codeLines } = stats;
  const comments = style.commentLines.lines / Math.max(1, codeLines);
  return [
    indentRow(indentationOf(style.indent)),
    {
      label: "Line length",
      icon: "ruler",
      lead: formatWhole(style.lineLength.median),
      rest: ` median · ${formatWhole(style.lineLength.p90)} p90 characters`,
      bar: null,
    },
    {
      label: "Comment lines",
      icon: "text",
      lead: `${(comments * 100).toFixed(1)}%`,
      rest: " of non-blank lines",
      bar: [{ entity: "slot-1", share: comments }],
    },
    ...habitRows(style),
  ];
};

/** What the report's stats show; false when the universe holds no file, so there is nothing to chart. */
export const hasStats = ({ files }: Report["stats"]): boolean => files > 0;
