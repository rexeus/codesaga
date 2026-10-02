// Owns the named bands of the function analysis: the edges, limits and sizes that the facts and the report both apply.
// The sources are named on the report's `thresholds.typescript`; they are bands for reading a distribution, not targets.

/** Complexity bands `0–4`, `5–9`, `10–14`, `15–24` and `25+`: the first value of each band after the first. */
export const COMPLEXITY_EDGES: ReadonlyArray<number> = [5, 10, 15, 25];

/** Sonar's default per-function limit of cognitive complexity (`eslint-plugin-sonarjs`). */
export const COMPLEXITY_LIMIT = 15;

/** Length bands in non-blank lines, `1–15`, `16–30`, `31–60` and `61+`, after the Software Improvement Group's guidance. */
export const LENGTH_EDGES: ReadonlyArray<number> = [16, 31, 61];

/** More parameters than this is a long parameter list (SIG). */
export const MAX_PARAMETERS = 4;

/** A file lists the functions with at least this complexity, for the history to compare by name. */
export const NOTABLE_MIN_COMPLEXITY = 3;

/** A file lists at most this many of them, hardest first. */
export const MAX_NOTABLE_PER_FILE = 40;

/** The hardest functions a block lists. */
export const TOP_FUNCTIONS = 5;

/** A file is a hotspot when its hardest function scores at least this ... */
export const HOTSPOT_MIN_COMPLEXITY = 10;

/** ... it has been revised at least this often ... */
export const HOTSPOT_MIN_REVISIONS = 2;

/** ... and it is at or above this quantile of both the hardest-function scores and the revisions of the production files with a function. */
export const HOTSPOT_QUANTILE = 0.9;

/** The files a block lists. */
export const MAX_HOTSPOTS = 5;
