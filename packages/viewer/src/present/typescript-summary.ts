import type { Report } from "@codesaga/engine";

import { formatShareExact } from "./code-stats.js";
import {
  formatCount,
  formatNoun,
  formatPercentTenth,
  formatPerThousand,
} from "./format.js";
import { strictFiles } from "./typescript-strictness.js";

/** The TypeScript deep dive of a report, which only reports with TypeScript or JavaScript files carry. */
export type TypeScriptDeepDive = NonNullable<
  NonNullable<Report["deepDives"]>["typescript"]
>;

type Coverage = TypeScriptDeepDive["coverage"];

/** What the deep dive could read, in words. */
export type CoverageView = {
  /** `1,685 of 1,687 files read`. */
  readonly headline: string;
  /** The rest: declaration files, skipped files by reason, the parser. */
  readonly notes: readonly string[];
};

/** A figure of the summary strip with what it counts. */
export type SummaryFigure = {
  readonly label: string;
  readonly value: string;
  readonly note: string;
};

/** What the section can show: only its coverage, or the figures and cards of every block the report carries. */
export type TypeScriptState =
  | {
      readonly kind: "unavailable" | "unread";
      readonly message: string;
      readonly coverage: CoverageView;
    }
  | {
      readonly kind: "ready";
      /** False for a repository whose code is JavaScript only: it has no types to escape from or to check. */
      readonly typed: boolean;
      readonly coverage: CoverageView;
      readonly figures: readonly SummaryFigure[];
    };

const SKIPPED_WORDS = [
  ["too-large", "too large (over 1 MiB)"],
  ["minified", "minified"],
  ["too-deep", "nested too deeply"],
  ["syntax-error", "with a syntax error"],
  ["parser-error", "that the parser failed on"],
  ["parser-crashed", "that crashed the parser"],
  ["unreadable", "unreadable"],
  ["parser-unavailable", "without a parser"],
] as const;

const skippedNote = ({ skipped }: Coverage): string[] => {
  const parts = SKIPPED_WORDS.flatMap(([reason, words]) => {
    const count = skipped[reason] ?? 0;
    return count === 0 ? [] : [`${formatCount(count)} ${words}`];
  });
  return parts.length === 0 ? [] : [`Skipped: ${parts.join(", ")}.`];
};

/** The words of the coverage block: how many files were read and what was left out. */
const coverageView = (coverage: Coverage): CoverageView => {
  const { files, parsed, declarationFiles, parser } = coverage;
  return {
    headline: `${formatCount(parsed)} of ${formatNoun(files, "file")} read`,
    notes: [
      ...(declarationFiles === 0
        ? []
        : [
            `${formatNoun(declarationFiles, "declaration file")} counted, not read.`,
          ]),
      ...skippedNote(coverage),
      parser.version === null
        ? `Parser: ${parser.name}, not loaded.`
        : `Parser: ${parser.name} ${parser.version}.`,
    ],
  };
};

type Block<Key extends keyof TypeScriptDeepDive> = NonNullable<
  TypeScriptDeepDive[Key]
>;

const escapeFigure = ({ production }: Block<"typeSafety">): SummaryFigure => ({
  label: "Escape hatches",
  value: formatPerThousand(production.escapesPer1000),
  note: `per 1,000 production lines · ${formatNoun(production.escapes, "site")}`,
});

const strictFigure = (strictness: Block<"strictness">): SummaryFigure => {
  const strict = strictFiles(strictness);
  if (strict === null) {
    return {
      label: "Strict mode",
      value: "No tsconfig",
      note: "no config governs a file",
    };
  }
  return {
    label: "Strict mode",
    value: formatShareExact(strict.on, strict.total),
    note: strict.listedOnly
      ? `of the files of the ${formatNoun(strictness.configs.length, "listed config")} compile with strict`
      : "of governed files compile with strict",
  };
};

const complexFigure = ({ production }: Block<"functions">): SummaryFigure => ({
  label: "Complex functions",
  value: formatPercentTenth(
    production.over15.functions / Math.max(1, production.functions),
  ),
  note: `score 15 or more · ${formatCount(production.over15.functions)} of ${formatCount(production.functions)}`,
});

const cycleFigure = ({ files }: Block<"imports">): SummaryFigure => ({
  label: "Import cycles",
  value: formatCount(files.cycles.count),
  note: `between production files${files.cycles.typeOnly > 0 ? ` · ${formatCount(files.cycles.typeOnly)} more by types only` : ""}`,
});

const testFigure = ({ cases, files }: Block<"tests">): SummaryFigure => ({
  label: "Test cases",
  value: formatCount(cases),
  note:
    cases === 0 && files > 0
      ? `none found in ${formatNoun(files, "test file")} by the runners' call shapes`
      : `in ${formatNoun(files, "test file")}`,
});

/** One figure per block the report carries, in a fixed order. */
const figuresOf = (
  deepDive: TypeScriptDeepDive,
  typed: boolean,
): SummaryFigure[] => {
  const { typeSafety, strictness, functions, imports, tests } = deepDive;
  return [
    ...(typeSafety === undefined || !typed ? [] : [escapeFigure(typeSafety)]),
    ...(strictness === undefined || !typed ? [] : [strictFigure(strictness)]),
    ...(functions === undefined ? [] : [complexFigure(functions)]),
    ...(imports === undefined ? [] : [cycleFigure(imports)]),
    ...(tests === undefined ? [] : [testFigure(tests)]),
  ];
};

/** Whether the repository has TypeScript files, as its code stats list the languages. */
export const hasTypeScriptFiles = (
  languages: readonly { readonly name: string }[],
): boolean => languages.some(({ name }) => name === "TypeScript");

/**
 * What the section shows. A parser that did not load, or a universe where no
 * file could be read, leaves the coverage and a calm note; otherwise the
 * figures of every block the report carries, in a fixed order. `typed` is
 * false for a JavaScript-only repository, which has no figure on types.
 */
export const typeScriptState = (
  deepDive: TypeScriptDeepDive,
  typed: boolean,
): TypeScriptState => {
  const coverage = coverageView(deepDive.coverage);
  if (deepDive.coverage.unavailable !== undefined) {
    return {
      kind: "unavailable",
      message: `The TypeScript analysis could not run here: ${deepDive.coverage.unavailable}. Everything else on this page is unaffected.`,
      coverage,
    };
  }
  if (deepDive.coverage.parsed === 0) {
    return {
      kind: "unread",
      message:
        "No TypeScript or JavaScript file could be read, so there is nothing to analyze.",
      coverage,
    };
  }
  return {
    kind: "ready",
    typed,
    coverage,
    figures: figuresOf(deepDive, typed),
  };
};
