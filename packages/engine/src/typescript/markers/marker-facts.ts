// Owns the debt-marker facts of one file: the TODO-style markers and `@deprecated` tags of its comments, and how many exported declarations carry a JSDoc block.
// Read from the parser's comments, never from the source text alone, so a marker inside a string or a template is not one.

import type { Node } from "@oxc-project/types";

import type { ParsedSource } from "../parsed-source.js";

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
const DEPRECATED = /@deprecated(?![\w-])/u;
/** A block that opens a file with legal text is not documentation of what follows it. */
const LEGAL = /@license|@preserve|copyright/iu;

type Comment = ParsedSource["comments"][number];

const isJsdoc = ({ type, value }: Comment): boolean =>
  type === "Block" && value.startsWith("*") && !LEGAL.test(value);

/** Whether only whitespace with no blank line lies between the comment and the statement. */
const isAttached = (
  text: string,
  comment: Comment,
  statement: Node,
): boolean => {
  const gap = text.slice(comment.end, statement.start);
  return /^[ \t]*\r?\n?[ \t]*$/u.test(gap);
};

/** The last comment that ends at or before `offset`, undefined when none does. */
const commentBefore = (
  comments: ParsedSource["comments"],
  offset: number,
): Comment | undefined => {
  let low = 0;
  let high = comments.length - 1;
  let found: Comment | undefined;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const comment = comments[middle];
    if (comment !== undefined && comment.end <= offset) {
      found = comment;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
};

const isExportedDeclaration = (statement: Node): boolean =>
  statement.type === "ExportDefaultDeclaration" ||
  (statement.type === "ExportNamedDeclaration" &&
    statement.declaration !== null);

const exportsOf = (
  { program, comments }: ParsedSource,
  text: string,
): Pick<MarkerFacts, "exportedDeclarations" | "documentedExports"> => {
  const exported = program.body.filter(isExportedDeclaration);
  const documented = exported.filter((statement) => {
    const comment = commentBefore(comments, statement.start);
    return (
      comment !== undefined &&
      isJsdoc(comment) &&
      isAttached(text, comment, statement)
    );
  });
  return {
    exportedDeclarations: exported.length,
    documentedExports: documented.length,
  };
};

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
