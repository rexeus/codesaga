import { formatWhole, pathTail } from "./code-stats.js";
import { formatCount, formatNoun, formatPercent } from "./format.js";
import type { HistogramView } from "./histograms.js";
import type { TypeScriptDeepDive } from "./typescript-summary.js";

type Functions = NonNullable<TypeScriptDeepDive["functions"]>;
type Part = Functions["production"];
type Entry = Part["top"][number];

const COMPLEXITY_LABELS = ["0–4", "5–9", "10–14", "15–24", "25+"];
const LENGTH_LABELS = ["1–15", "16–30", "31–60", "61+"];

const bins = (counts: readonly number[], labels: readonly string[]) =>
  labels.map((label, index) => ({ label, files: counts[index] ?? 0 }));

const namedFunction = ({ path, line, name }: Entry, note: string) => ({
  path,
  name: `${pathTail(path)}:${line}`,
  note: name.startsWith("(anonymous)")
    ? `${note}, anonymous`
    : `${note}, ${name}`,
});

/**
 * The functions of the production code by cognitive complexity, as the
 * histogram card draws them. The hardest function is named under the facts.
 */
export const complexityHistogram = ({
  production,
}: Functions): HistogramView => {
  const { complexity, top } = production;
  const [hardest] = top;
  return {
    title: "Cognitive complexity of functions",
    subtitle: `${formatNoun(production.functions, "function")} of production code, by the SonarSource score`,
    unit: "complexity",
    noun: "functions",
    bins: bins(complexity.bands, COMPLEXITY_LABELS),
    facts: [
      { value: formatWhole(complexity.p50), label: "median function" },
      { value: formatWhole(complexity.p90), label: "p90" },
      { value: formatCount(complexity.max), label: "hardest" },
    ],
    named:
      hardest === undefined ? null : namedFunction(hardest, "hardest function"),
    rangeHeading: "Complexity",
    annotateAll: true,
  };
};

/** Production functions by length in non-blank lines, with the shapes that are easy to count. */
export const lengthHistogram = ({ production }: Functions): HistogramView => ({
  title: "Function length",
  subtitle: `${formatNoun(production.functions, "function")} of production code, by non-blank lines`,
  unit: "lines",
  noun: "functions",
  bins: bins(production.lengths, LENGTH_LABELS),
  facts: [
    {
      value: formatCount(production.longParameterLists),
      label: "with more than 4 parameters",
    },
    { value: formatCount(production.maxDepth), label: "deepest nesting" },
    {
      value: formatPercent(production.over15.lineShare),
      label: "of lines in functions scoring 15+",
    },
  ],
  named: null,
  rangeHeading: "Lines per function",
  annotateAll: true,
});

/** A function of the top list. */
export type TopFunctionRow = {
  /** The function's name; `(anonymous)` for a callback. */
  readonly name: string;
  readonly anonymous: boolean;
  /** `src/OpenAiLanguageModel.ts:829`; `path` holds the whole path for the tooltip. */
  readonly place: string;
  readonly path: string;
  readonly complexity: string;
  readonly lines: string;
  /** The complexity over the hardest one's, 0 to 1. */
  readonly fraction: number;
};

/** The hardest functions of the production code, each sized against the hardest. */
export const topFunctionRows = ({
  production,
}: Functions): TopFunctionRow[] => {
  const hardest = Math.max(1, production.complexity.max);
  return production.top.map(({ name, path, line, complexity, lines }) => ({
    name,
    anonymous: name.startsWith("(anonymous)"),
    place: `${pathTail(path)}:${line}`,
    path,
    complexity: formatCount(complexity),
    lines: formatNoun(lines, "line"),
    fraction: complexity / hardest,
  }));
};

/** What the tests' functions look like, in one line; null when the repository has none. */
export const testFunctionsLine = ({ tests }: Functions): string | null => {
  if (tests.functions === 0) {
    return null;
  }
  const over = tests.over15.functions;
  return `Test code: ${formatNoun(tests.functions, "function")}, ${over === 0 ? "none" : formatCount(over)} scoring 15 or more, hardest ${formatCount(tests.complexity.max)}.`;
};

type ComplexityAndChange = NonNullable<
  TypeScriptDeepDive["complexityAndChange"]
>;

/** The files where hard functions and many revisions meet. */
export type ChangeView = {
  /** `32 of 1,093 files hold a function scoring 15 or more; 24% of the revisions landed in them.` */
  readonly summary: string;
  readonly shallow: boolean;
  readonly hotspots: readonly {
    readonly name: string;
    readonly path: string;
    readonly complexity: string;
    readonly revisions: string;
    /** The revisions over the most revised hotspot's, 0 to 1. */
    readonly fraction: number;
  }[];
};

/** The hotspots with the sentence that frames them. */
export const changeView = ({
  files,
  complexFiles,
  complexRevisionShare,
  hotspots,
  shallow,
}: ComplexityAndChange): ChangeView => {
  const most = Math.max(1, ...hotspots.map(({ revisions }) => revisions));
  return {
    summary: `${formatCount(complexFiles)} of ${formatNoun(files, "file")} hold a function scoring 15 or more; ${formatPercent(complexRevisionShare)} of the revisions landed in them.`,
    shallow: shallow === true,
    hotspots: hotspots.map(({ path, complexity, revisions }) => ({
      name: pathTail(path),
      path,
      complexity: formatCount(complexity),
      revisions: formatCount(revisions),
      fraction: revisions / most,
    })),
  };
};
