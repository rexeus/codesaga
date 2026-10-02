import { formatShare } from "./code-stats.js";
import { formatCount, formatNoun, formatPerThousand } from "./format.js";
import type { TypeScriptDeepDive } from "./typescript-summary.js";

type TypeSafety = NonNullable<TypeScriptDeepDive["typeSafety"]>;
type Part = TypeSafety["production"];
type Count = keyof Part["counts"];

/** The kinds of escape site, in the order of the bar. Their counts add up to `escapes`. */
const ESCAPE_KINDS: readonly {
  readonly key: Count;
  readonly label: string;
  readonly entity: string;
}[] = [
  { key: "anyOutsideAssertions", label: "Explicit any", entity: "slot-1" },
  { key: "assertionChains", label: "Type assertions", entity: "slot-2" },
  { key: "nonNull", label: "Non-null assertions", entity: "slot-3" },
  { key: "tsExpectError", label: "@ts-expect-error", entity: "slot-4" },
  { key: "tsIgnore", label: "@ts-ignore", entity: "slot-5" },
  { key: "tsNocheck", label: "@ts-nocheck", entity: "slot-6" },
  { key: "lintDisables", label: "Lint disables", entity: "slot-7" },
];

/** The escape sites of one set of files as a headline rate and a bar. */
export type EscapeSet = {
  readonly label: string;
  /** Escape sites per 1,000 lines. */
  readonly rate: string;
  /** `7,677 sites in 485,989 lines of 1,093 files`. */
  readonly caption: string;
  /** `46% of the files have one`. */
  readonly fileShare: string;
  readonly segments: readonly {
    readonly label: string;
    readonly entity: string;
    readonly count: number;
  }[];
};

const escapeSet = (label: string, part: Part): EscapeSet | null =>
  part.files === 0
    ? null
    : {
        label,
        rate: formatPerThousand(part.escapesPer1000),
        caption: `${formatNoun(part.escapes, "site")} in ${formatNoun(part.lines, "line")} of ${formatNoun(part.files, "file")}`,
        fileShare: `${formatShare(part.filesWithEscape, part.files)} of the files have one`,
        segments: ESCAPE_KINDS.map(({ key, label: kind, entity }) => ({
          label: kind,
          entity,
          count: part.counts[key],
        })),
      };

/** The production code first and the tests after it; a set with no file is left out. */
export const escapeSets = ({ production, tests }: TypeSafety): EscapeSet[] =>
  [escapeSet("Production code", production), escapeSet("Tests", tests)].filter(
    (set) => set !== null,
  );

/** A count of one kind of site in production code and in tests, with its rate per 1,000 lines. */
export type KindRow = {
  readonly label: string;
  readonly entity: string;
  readonly production: Cell;
  /** Null when the repository has no test files. */
  readonly tests: Cell | null;
};

type Cell = { readonly count: string; readonly rate: string };

const cellOf = (part: Part, key: Count): Cell => ({
  count: formatCount(part.counts[key]),
  rate: formatPerThousand(part.per1000[key]),
});

/** One row per kind of escape site, as the bar draws them. */
export const kindRows = ({ production, tests }: TypeSafety): KindRow[] =>
  ESCAPE_KINDS.map(({ key, label, entity }) => ({
    label,
    entity,
    production: cellOf(production, key),
    tests: tests.files === 0 ? null : cellOf(tests, key),
  }));

/** A figure beside the escapes that keeps types honest, or says where `any` is no hole. */
export type CounterpartRow = {
  readonly label: string;
  readonly note: string;
  readonly cell: Cell;
};

const COUNTERPARTS: readonly {
  readonly key: Count;
  readonly label: string;
  readonly note: string;
}[] = [
  {
    key: "unknown",
    label: "unknown",
    note: "the type that must be checked before use",
  },
  {
    key: "satisfies",
    label: "satisfies",
    note: "checks a value without widening its type",
  },
  {
    key: "typePredicates",
    label: "Type predicates",
    note: "x is T, narrowing with a function",
  },
  {
    key: "any",
    label: "any keywords",
    note: "every one, whether it is an escape or not",
  },
  {
    key: "asAny",
    label: "as any",
    note: "casts to any; one site each",
  },
  {
    key: "doubleAssertions",
    label: "as unknown as T",
    note: "casts through a second type; one site each",
  },
  {
    key: "benignAny",
    label: "any with no better type",
    note: "rest parameters and generic constraints; not an escape",
  },
];

/** The counterparts and the overlapping counts of production code, to read beside the bar. */
export const counterpartRows = ({ production }: TypeSafety): CounterpartRow[] =>
  COUNTERPARTS.map(({ key, label, note }) => ({
    label,
    note,
    cell: cellOf(production, key),
  }));
