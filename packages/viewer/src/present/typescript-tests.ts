import { formatShare } from "./code-stats.js";
import { formatCount, formatNoun } from "./format.js";
import type { TypeScriptDeepDive } from "./typescript-summary.js";

type Tests = NonNullable<TypeScriptDeepDive["tests"]>;

const ASSERTION_LABELS = ["none", "1", "2–3", "4 or more"];
const ASSERTION_ENTITIES = ["slot-other", "slot-1", "slot-3", "slot-7"];

/** A count of something about the tests. */
type TestFact = { readonly label: string; readonly count: string };

/** The test cases and how they are marked and checked. */
export type TestsView = {
  /** `4,210 cases in 592 files`. */
  readonly headline: string;
  readonly frameworks: string;
  readonly assertionSegments: readonly {
    readonly label: string;
    readonly count: number;
    readonly share: string;
    readonly entity: string;
  }[];
  readonly marks: readonly TestFact[];
  /** The first files that hold a focused marker, which makes a runner skip every other test. */
  readonly focusedFiles: readonly string[];
  /** `and 3 more files` when more files hold one than the report lists, or null. */
  readonly focusedMore: string | null;
};

/** The cases, how many direct assertions they make, and how they are marked; no judgement of a count. */
export const testsView = ({
  files,
  frameworks,
  cases,
  assertions,
  skipped,
  focused,
  todo,
  parameterized,
  snapshots,
  typeTests,
  focusedFiles,
  focusedFileCount,
}: Tests): TestsView => {
  const withBody = assertions.reduce((sum, count) => sum + count, 0);
  return {
    headline: `${formatNoun(cases, "case")} in ${formatNoun(files, "file")}`,
    frameworks:
      frameworks.length === 0
        ? "No test framework detected"
        : frameworks.join(", "),
    assertionSegments: ASSERTION_LABELS.map((label, index) => ({
      label,
      count: assertions[index] ?? 0,
      share: formatShare(assertions[index] ?? 0, withBody),
      entity: ASSERTION_ENTITIES[index] ?? "slot-other",
    })),
    marks: [
      { label: "Parameterized (each)", count: formatCount(parameterized) },
      { label: "Skipped", count: formatCount(skipped) },
      { label: "Focused (only)", count: formatCount(focused) },
      { label: "Todo", count: formatCount(todo) },
      { label: "Snapshot checks", count: formatCount(snapshots) },
      { label: "Type tests", count: formatCount(typeTests) },
    ],
    focusedFiles,
    focusedMore:
      focusedFileCount > focusedFiles.length
        ? `and ${formatNoun(focusedFileCount - focusedFiles.length, "more file")}`
        : null,
  };
};

/** The folded card's line: files, cases and how many cases are marked. */
export const testsTeaser = ({
  files,
  cases,
  skipped,
  focused,
}: Tests): string => {
  const marked = [
    ...(skipped === 0 ? [] : [`${formatCount(skipped)} skipped`]),
    ...(focused === 0 ? [] : [`${formatCount(focused)} focused`]),
  ];
  return [formatNoun(files, "file"), formatNoun(cases, "case"), ...marked].join(
    " · ",
  );
};
