// Owns the debt-marker facts of one file: the TODO-style markers and `@deprecated` tags of its comments, and how many exported declarations carry a JSDoc block.
// Read from the parser's comments, never from the source text alone, so a marker inside a string or a template is not one.

import type { ParsedSource } from "../parsed-source.js";
import { exportsOf } from "./export-docs.js";

/** Counts of one file; additive across files. */
export type MarkerFacts = {
  /** Comment lines that begin with the marker, after any comment decoration: `// TODO:`, ` * FIXME`. */
  readonly todo: number;
  readonly fixme: number;
  readonly hack: number;
  readonly xxx: number;
  /** Comments that carry an `@deprecated` tag. */
  readonly deprecated: number;
  /** Exported declarations: `export` followed by a declaration, and `export default`; re-exports and `export { a }` lists are not. */
  readonly exportedDeclarations: number;
  /** The exported declarations with a JSDoc block directly before them. */
  readonly documentedExports: number;
};

/** The marker at the start of a comment line, after the characters that decorate one. */
const MARKER = /^[ \t*/#-]*(TODO|FIXME|HACK|XXX)\b/gmu;
/** An `@deprecated` tag at the start of a comment line, as a marker is; prose that mentions it does not count. */
const DEPRECATED = /^[ \t*/#-]*@deprecated(?![\w-])/mu;
/** The debt-marker facts of a parse and the text it read. */
export const markersOf = (parsed: ParsedSource, text: string): MarkerFacts => {
  const found = { TODO: 0, FIXME: 0, HACK: 0, XXX: 0 };
  let deprecated = 0;
  for (const { value } of parsed.comments) {
    for (const [, marker] of value.matchAll(MARKER)) {
      if (
        marker === "TODO" ||
        marker === "FIXME" ||
        marker === "HACK" ||
        marker === "XXX"
      ) {
        found[marker] += 1;
      }
    }
    deprecated += DEPRECATED.test(value) ? 1 : 0;
  }
  return {
    todo: found.TODO,
    fixme: found.FIXME,
    hack: found.HACK,
    xxx: found.XXX,
    deprecated,
    ...exportsOf(parsed, text),
  };
};
