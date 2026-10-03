// Owns the thresholds schema of the TypeScript deep dive: the bands and limits its figures are read through.
// Apart from the report's other thresholds so that each file stays within its size.
import { Schema } from "effect";

const Count = Schema.Natural;
const Share = Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 }));

/**
 * The bands and limits of the TypeScript deep dive. They are named bands from
 * cited sources for reading a distribution, not targets: 15 is the default
 * limit of Sonar's cognitive-complexity rule, the length and parameter bands
 * follow the Software Improvement Group's guidance.
 */
export const TypeScriptThresholds = Schema.Struct({
  /** The complexity bands `0–4`, `5–9`, `10–14`, `15–24` and `25+`, as the first value of each band after the first. */
  complexityBands: Schema.Array(Count),
  /** The per-function limit of cognitive complexity (Sonar's default); `over15` counts functions at or above it. */
  complexityLimit: Count,
  /** The length bands `1–15`, `16–30`, `31–60` and `61+` non-blank lines, as the first value of each band after the first. */
  lengthBands: Schema.Array(Count),
  /** A function has a long parameter list with more parameters than this. */
  maxParameters: Count,
  /** The assertion bands `0`, `1`, `2–3` and `4+` per test case, as the first value of each band after the first. */
  assertionBands: Schema.Array(Count),
  /** A file is a complexity hotspot at or above this quantile of the hardest-function scores and of the revisions among the production files with a function ... */
  hotspotQuantile: Share,
  /** ... with a hardest function of at least this score ... */
  hotspotMinComplexity: Count,
  /** ... and at least this many revisions. */
  hotspotMinRevisions: Count,
  /** A source over this many characters is not parsed (`too-large`). */
  maxSourceCharacters: Count,
  /** A source whose non-blank lines average more characters than this is minified and not parsed. */
  minifiedMeanLineLength: Count,
  /** The import structure's rules. */
  imports: Schema.Struct({
    /** `towardLessStable` lists an import edge toward a territory whose instability is at least this much higher. */
    instabilityGap: Schema.Finite,
    /** It needs both territories to have at least this many import edges in and out together. */
    minEdges: Count,
  }),
});
