// Owns the code stats schema: facts about a set of code files, for the repository and for every territory.
// Same shape everywhere, so a card and the repository's own block read alike. Facts only, never a score.
import { Schema } from "effect";

const Count = Schema.Natural;
const Share = Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 }));

/** A file and the number of times it changed. */
const ChangedFile = Schema.Struct({
  path: Schema.String,
  revisions: Count,
});

/**
 * Facts about a set of universe files at HEAD and the history behind them.
 * Medians and percentiles interpolate between the two closest ranks, and
 * fractional values keep 4 decimals. A territory's stats leave out the
 * histograms and list fewer of the most changed files than the repository's.
 *
 * A `histogram` is the number of files per bucket, in ascending order of the
 * measure and with empty buckets included, so its position names the bucket.
 * The edges are fixed; a value on an edge belongs to the bucket that starts there.
 */
export const CodeStats = Schema.Struct({
  /** Universe files in the set. */
  files: Count,
  /** Non-blank lines of those files. */
  codeLines: Count,
  /**
   * Lines per file. A file without a code line counts in `files` but not here,
   * nor in the complexity figures, so `min` is at least 1 and the histogram can
   * hold fewer files than `files`.
   */
  fileLength: Schema.Struct({
    min: Count,
    median: Schema.Finite,
    max: Count,
    /**
     * Only in the report's own `stats`. Files by lines, in 6 buckets: 1–50,
     * 51–100, 101–200, 201–400, 401–800 and more than 800 lines.
     */
    histogram: Schema.optionalKey(Schema.Array(Count)),
    /** Path of the file with the most lines, the first by path on a tie; null for no such file. */
    longestFile: Schema.NullOr(Schema.String),
  }),
  /** Languages of the files, most lines first, then by name. */
  languages: Schema.Array(
    Schema.Struct({ name: Schema.String, files: Count, lines: Count }),
  ),
  /** Test files, told by their path as the `well-tested` badge does, and their lines. */
  tests: Schema.Struct({ files: Count, lines: Count }),
  /**
   * Revisions: the commits that changed a file over the full history,
   * following renames, in the current life of its path. A file without a known
   * commit, as in a shallow clone, counts one.
   */
  churn: Schema.Struct({
    /** Median revisions per file. */
    median: Schema.Finite,
    p90: Schema.Finite,
    /** Revisions of all files together. */
    revisions: Count,
    /** The sum over the files of revisions times code lines; the weight that `thresholds.badges.hotspotShare` compares, after codeheat's churn times size. */
    revisionLines: Count,
    /**
     * Only in the report's own `stats`. Files by revisions, in 6 buckets: 1, 2,
     * 3–4, 5–9, 10–19 and 20 or more.
     */
    histogram: Schema.optionalKey(Schema.Array(Count)),
    /**
     * The files with the most revisions, most first, then by path: the five
     * most changed of the repository, the three of a territory.
     */
    mostChanged: Schema.Array(ChangedFile).check(Schema.isMaxLength(5)),
  }),
  /**
   * Indentation complexity, ported from codeheat: the indentation levels of a
   * line, where a tab is one level and spaces count `floor(spaces / width)`
   * with the width detected per file (2 to 8), summed over the non-blank lines.
   */
  complexity: Schema.Struct({
    /** Levels per non-blank line over all the files. */
    perLine: Schema.Finite,
    /** Median over the files of their own levels per line. */
    medianFile: Schema.Finite,
    /** The deepest level of any line. */
    deepestLevel: Count,
    /**
     * Only in the report's own `stats`. Files by their levels per line, in 6
     * buckets: below 0.25, 0.25 to below 0.5, 0.5 to below 1, 1 to below 1.5,
     * 1.5 to below 2, and 2 or more.
     */
    histogram: Schema.optionalKey(Schema.Array(Count)),
    /** The file with the most levels per line, the first by path on a tie; null for no such file. */
    deepestFile: Schema.NullOr(
      Schema.Struct({ path: Schema.String, perLine: Schema.Finite }),
    ),
  }),
  style: Schema.Struct({
    /**
     * Shares of the lines that start with a space or a tab; 0 for both when no
     * line is indented. `width` is the most common indentation width in
     * spaces, each file voting with its space-indented lines; 0 without any.
     */
    indent: Schema.Struct({
      spacesShare: Share,
      tabsShare: Share,
      width: Count,
    }),
    /** Characters per non-blank line, trailing whitespace not counted. */
    lineLength: Schema.Struct({ median: Schema.Finite, p90: Schema.Finite }),
    /**
     * Lines that start with a comment of the language's family: `//` or a
     * C-style block, `#`, `--`, or an HTML block. The lines of a block count
     * until it closes. A trailing comment leaves its line a code line, and
     * languages without a listed syntax count none. `share` is of `codeLines`.
     */
    commentLines: Schema.Struct({ lines: Count, share: Share }),
    /**
     * Only in the report's own `stats`, not in a territory's: the non-merge
     * commits of the activity window whose subject starts with a Conventional
     * Commits type (`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`,
     * `build`, `ci`, `chore`, `revert`) and an optional scope, `!` and `: `.
     */
    conventionalCommits: Schema.optionalKey(
      Schema.Struct({ commits: Count, conventional: Count, share: Share }),
    ),
    /**
     * Only in the report's own `stats`, not in a territory's: the lines added
     * and deleted in code files per commit of the activity window, over the
     * commits that changed any, and how many that was.
     */
    commitSize: Schema.optionalKey(
      Schema.Struct({
        commits: Count,
        median: Schema.Finite,
        p90: Schema.Finite,
      }),
    ),
  }),
});
export type CodeStats = typeof CodeStats.Type;
