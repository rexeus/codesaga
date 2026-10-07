import type { TrendAxis } from "../layout/trend.js";
import {
  formatCompact,
  formatCount,
  formatMonth,
  formatNoun,
} from "./format.js";
import type { TypeScriptDeepDive } from "./typescript-summary.js";

type Trends = NonNullable<TypeScriptDeepDive["trends"]>;

/** The lines of the trend chart. */
export type TrendId = "escapes" | "any" | "complex" | "esm" | "cases";

/** What one line of the chart shows. */
type TrendSpec = {
  readonly id: TrendId;
  /** The button of the picker. */
  readonly label: string;
  readonly title: string;
  readonly subtitle: string;
  /** What the value is in a tooltip, after the figure. */
  readonly unit: string;
  /** The value of month `index`, or null where nothing is counted yet. */
  readonly value: (series: Series, index: number) => number | null;
  /** The counts behind the value, for a tooltip. */
  readonly detail: (series: Series, index: number) => string;
  readonly format: (value: number) => string;
  readonly axis: TrendAxis;
};

type Series = (name: string, index: number) => number;

const rate = (count: number, lines: number): number | null =>
  lines === 0 ? null : (count * 1000) / lines;

const share = (part: number, whole: number): number | null =>
  whole === 0 ? null : (part * 100) / whole;

const formatRate = (value: number): string =>
  value > 0 && value < 0.05 ? "<0.1" : value.toFixed(1);

const formatPercentValue = (value: number): string =>
  value > 0 && value < 0.05 ? "<0.1%" : `${value.toFixed(1)}%`;

const rateAxis: TrendAxis = {
  label: (value, digits) =>
    digits === 0 ? formatCompact(value) : value.toFixed(digits),
  whole: false,
};

const percentAxis: TrendAxis = {
  label: (value, digits) =>
    `${digits === 0 ? formatCompact(value) : value.toFixed(digits)}%`,
  whole: false,
};

const countAxis: TrendAxis = {
  label: (value) => formatCompact(value),
  whole: true,
};

const SPECS: readonly TrendSpec[] = [
  {
    id: "escapes",
    label: "Escape hatches",
    title: "Escape hatches per 1,000 lines",
    subtitle: "Production code, at the end of each month",
    unit: "per 1,000 lines",
    value: (at, index) =>
      rate(at("production.escapes", index), at("production.lines", index)),
    detail: (at, index) =>
      `${formatNoun(at("production.escapes", index), "site")} in ${formatNoun(at("production.lines", index), "line")}`,
    format: formatRate,
    axis: rateAxis,
  },
  {
    id: "any",
    label: "any",
    title: "any keywords per 1,000 lines",
    subtitle: "Production code, at the end of each month",
    unit: "per 1,000 lines",
    value: (at, index) =>
      rate(at("production.any", index), at("production.lines", index)),
    detail: (at, index) =>
      `${formatNoun(at("production.any", index), "keyword")} in ${formatNoun(at("production.lines", index), "line")}`,
    format: formatRate,
    axis: rateAxis,
  },
  {
    id: "complex",
    label: "Complex functions",
    title: "Share of functions scoring 15 or more",
    subtitle: "Production code, at the end of each month",
    unit: "of the functions",
    value: (at, index) =>
      share(
        at("production.complexFunctions", index),
        at("production.functions", index),
      ),
    detail: (at, index) =>
      `${formatCount(at("production.complexFunctions", index))} of ${formatNoun(at("production.functions", index), "function")}`,
    format: formatPercentValue,
    axis: percentAxis,
  },
  {
    id: "esm",
    label: "ES modules",
    title: "Share of module files that are ES modules",
    subtitle: "Production code, at the end of each month; the rest is CommonJS",
    unit: "of the module files",
    value: (at, index) =>
      share(
        at("production.esmFiles", index),
        at("production.esmFiles", index) +
          at("production.commonjsFiles", index),
      ),
    detail: (at, index) =>
      `${formatNoun(at("production.esmFiles", index), "ES module file")}, ${formatCount(at("production.commonjsFiles", index))} CommonJS`,
    format: formatPercentValue,
    axis: percentAxis,
  },
  {
    id: "cases",
    label: "Test cases",
    title: "Test cases",
    subtitle: "Declared in the test files, at the end of each month",
    unit: "test cases",
    value: (at, index) => at("tests.testCases", index),
    detail: (at, index) =>
      `${formatCount(at("tests.focusedTests", index))} focused, in ${formatNoun(at("tests.files", index), "test file")}`,
    format: formatCount,
    axis: countAxis,
  },
];

/** One month of a line. */
type TrendMonth = {
  /** `Dec 2023`. */
  readonly label: string;
  readonly value: number | null;
  /** The value as the tooltip words it, or `–` before anything is counted. */
  readonly figure: string;
  /** The counts behind it. */
  readonly detail: string;
};

/** A line of the chart with everything to draw and title it. */
export type TrendLine = {
  readonly id: TrendId;
  readonly title: string;
  readonly subtitle: string;
  readonly unit: string;
  readonly months: readonly string[];
  readonly values: readonly (number | null)[];
  readonly details: readonly TrendMonth[];
  readonly axis: TrendAxis;
};

const seriesOf =
  ({ series }: Trends): Series =>
  (name, index) =>
    series[name]?.[index] ?? 0;

/** The lines of the picker: its choices in a fixed order, a line only when the report carries the series it needs, and the two about types only for a repository that has types. */
export const trendChoices = (
  { series }: Trends,
  typed: boolean,
): readonly { readonly id: TrendId; readonly label: string }[] =>
  SPECS.filter(({ id }) => {
    if (id === "cases") {
      return series["tests.testCases"] !== undefined;
    }
    const aboutTypes = id === "escapes" || id === "any";
    return series["production.lines"] !== undefined && (typed || !aboutTypes);
  }).map(({ id, label }) => ({ id, label }));

/** One line of the chart: the value of every month, and what the tooltip says of it. */
export const trendLine = (trends: Trends, id: TrendId): TrendLine => {
  const spec = SPECS.find((entry) => entry.id === id) ?? SPECS[0];
  if (spec === undefined) {
    throw new TypeError("There is no trend line.");
  }
  const at = seriesOf(trends);
  const values = trends.months.map((_, index) => spec.value(at, index));
  return {
    id: spec.id,
    title: spec.title,
    subtitle: spec.subtitle,
    unit: spec.unit,
    months: trends.months,
    values,
    axis: spec.axis,
    details: trends.months.map((month, index) => {
      const value = values[index] ?? null;
      return {
        label: formatMonth(month),
        value,
        figure: value === null ? "–" : spec.format(value),
        detail: spec.detail(at, index),
      };
    }),
  };
};

/**
 * Words for where the series starts, when that is later than the repository:
 * the replay follows the first-parent chain of HEAD and the histories that
 * merges absorbed, which can all begin after the first commit (a shallow
 * clone, a history merged into a branch). Null when the series starts with the repository, and when
 * there is no month.
 */
export const startNote = (
  { months }: Trends,
  firstCommitAt: string | null,
): string | null => {
  const [first] = months;
  if (first === undefined) {
    return null;
  }
  const started = firstCommitAt?.slice(0, 7);
  if (started === undefined || first <= started) {
    return null;
  }
  return `The series starts in ${formatMonth(first)}, the month of the oldest commit it reads: the first-parent chain of HEAD and the histories that merges absorbed begin there. The repository's first commit is from ${formatMonth(started)}.`;
};
