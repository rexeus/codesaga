import { formatLevels, formatWhole, pathTail } from "./code-stats.js";
import type { CodeStats } from "./code-stats.js";
import { formatCompact, formatCount, formatNoun } from "./format.js";

/** The buckets of the engine's histograms, in its order; their ranges are documented on `stats` in the report. */
const FILE_LENGTH_LABELS = [
  "1–50",
  "51–100",
  "101–200",
  "201–400",
  "401–800",
  "> 800",
];
const CHURN_LABELS = ["1", "2", "3–4", "5–9", "10–19", "20+"];
const COMPLEXITY_LABELS = [
  "<0.25",
  "0.25–0.5",
  "0.5–1",
  "1–1.5",
  "1.5–2",
  "2+",
];

/** One bucket of a histogram. */
export type HistogramBin = {
  readonly label: string;
  /** The count of what the histogram counts, see `HistogramView.noun`. */
  readonly files: number;
};

/** A figure with what it counts, under a histogram. */
type Fact = { readonly value: string; readonly label: string };

/** A histogram of files with the figures that sum it up. */
export type HistogramView = {
  readonly title: string;
  readonly subtitle: string;
  /** What a bucket's range measures, for its tooltip: `lines`, `revisions`. */
  readonly unit: string;
  /** What the buckets count, plural: `files`, `functions`. */
  readonly noun: string;
  readonly bins: readonly HistogramBin[];
  readonly facts: readonly Fact[];
  /** A file worth naming under the facts, with what makes it so; null when there is none. */
  readonly named: {
    readonly path: string;
    readonly name: string;
    readonly note: string;
  } | null;
  /** The label of the first column of the table view. */
  readonly rangeHeading: string;
  /** Whether every bar carries its count, for a histogram so skewed that the small bars would otherwise go unread. */
  readonly annotateAll: boolean;
};

/** The files per bucket in the report's own `stats`, which alone carries histograms; a missing one counts as empty. */
const binsOf = (
  histogram: readonly number[] | undefined,
  labels: readonly string[],
): HistogramBin[] =>
  labels.map((label, index) => ({
    label,
    files: histogram?.[index] ?? 0,
  }));

const fileLengthView = ({
  files,
  codeLines,
  fileLength,
}: CodeStats): HistogramView => ({
  title: "Size and file length",
  subtitle: `${formatNoun(files, "file")}, ${formatNoun(codeLines, "line")}. Files by length in lines`,
  unit: "lines",
  noun: "files",
  bins: binsOf(fileLength.histogram, FILE_LENGTH_LABELS),
  facts: [
    { value: formatCount(fileLength.min), label: "shortest" },
    { value: formatWhole(fileLength.median), label: "median" },
    { value: formatCount(fileLength.max), label: "longest" },
  ],
  named:
    fileLength.longestFile === null
      ? null
      : {
          path: fileLength.longestFile,
          name: pathTail(fileLength.longestFile),
          note: "longest file",
        },
  rangeHeading: "Lines per file",
  annotateAll: false,
});

const churnView = ({ churn }: CodeStats): HistogramView => ({
  title: "How often files change",
  subtitle: "Files by number of revisions (commits that touched them)",
  unit: "revisions",
  noun: "files",
  bins: binsOf(churn.histogram, CHURN_LABELS),
  facts: [
    { value: formatWhole(churn.median), label: "median revisions" },
    { value: formatWhole(churn.p90), label: "p90" },
    { value: formatCompact(churn.revisions), label: "revisions in total" },
  ],
  named: null,
  rangeHeading: "Revisions",
  annotateAll: false,
});

const complexityView = ({ complexity }: CodeStats): HistogramView => ({
  title: "Indentation complexity",
  subtitle: "Files by indentation levels per non-blank line (as in codeheat)",
  unit: "levels per line",
  noun: "files",
  bins: binsOf(complexity.histogram, COMPLEXITY_LABELS),
  facts: [
    { value: formatLevels(complexity.perLine), label: "levels per line" },
    { value: formatLevels(complexity.medianFile), label: "median file" },
    { value: formatCount(complexity.deepestLevel), label: "deepest level" },
  ],
  named:
    complexity.deepestFile === null
      ? null
      : {
          path: complexity.deepestFile.path,
          name: pathTail(complexity.deepestFile.path),
          note: `deepest on average, ${complexity.deepestFile.perLine.toFixed(1)} per line`,
        },
  rangeHeading: "Levels per line",
  annotateAll: false,
});

/** The three histograms of the Stats section: file length, revisions and complexity. */
export const histogramViews = (stats: CodeStats): HistogramView[] => [
  fileLengthView(stats),
  churnView(stats),
  complexityView(stats),
];

/**
 * The bucket that holds the middle file: the first whose running total reaches
 * half of the files in the histogram. Null for an empty histogram.
 */
export const medianBucket = (counts: readonly number[]): number | null => {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total === 0) {
    return null;
  }
  let running = 0;
  return counts.findIndex((count) => {
    running += count;
    return running * 2 >= total;
  });
};
