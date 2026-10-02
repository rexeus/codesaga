// Owns the shape of `deepDives.typescript.markers`: the debt markers in comments and how many exports are documented.
// Facts about production code, with no age and no verdict: no study ties either to quality.
import { Schema } from "effect";

const Count = Schema.Natural;

/** The debt markers of the production files. */
export const Markers = Schema.Struct({
  /** Parsed production files. */
  files: Count,
  /** Non-blank lines of those files. */
  lines: Count,
  /** Comment lines that begin with `TODO`, after any comment decoration. A marker inside a string or a template is not one. */
  todo: Count,
  fixme: Count,
  hack: Count,
  xxx: Count,
  /** Comments that carry an `@deprecated` tag. */
  deprecated: Count,
  /** Exported declarations: `export` followed by a declaration, and `export default`; re-exports and `export { a }` lists are not. */
  exportedDeclarations: Count,
  /** Exported declarations with a JSDoc block directly before them; a license header is not one. */
  documentedExports: Count,
  /** `documentedExports` over `exportedDeclarations`; 0 for none. */
  documentedShare: Schema.Finite.check(
    Schema.isBetween({ minimum: 0, maximum: 1 }),
  ),
});
export type Markers = typeof Markers.Type;
