// Owns counting the exported declarations of a file and how many of them a JSDoc block documents.
// A block documents the declaration it is directly above; line comments between them (pragmas such as `// eslint-disable-next-line`) do not break that, a blank line or any other block comment does.

import type { Node } from "@oxc-project/types";

import type { ParsedSource } from "../parsed-source.js";

type Comment = ParsedSource["comments"][number];

/** A block that opens a file with legal text is not documentation of what follows it. */
const LEGAL = /@license|@preserve|copyright/iu;
/** Whitespace with at most one line break. */
const ADJACENT = /^[ \t]*\r?\n?[ \t]*$/u;

const isJsdoc = ({ type, value }: Comment): boolean =>
  type === "Block" && value.startsWith("*") && !LEGAL.test(value);

/** The last comment that ends at or before `offset`, as an index into `comments`; -1 when none does. */
const lastBefore = (
  comments: ParsedSource["comments"],
  offset: number,
): number => {
  let low = 0;
  let high = comments.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if ((comments[middle]?.end ?? Infinity) <= offset) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
};

/** Whether a JSDoc block sits directly above `offset`, looking through line comments. */
const hasJsdocAbove = (
  comments: ParsedSource["comments"],
  text: string,
  offset: number,
): boolean => {
  let boundary = offset;
  for (let index = lastBefore(comments, offset); index >= 0; index--) {
    const comment = comments[index];
    if (
      comment === undefined ||
      !ADJACENT.test(text.slice(comment.end, boundary))
    ) {
      return false;
    }
    if (isJsdoc(comment)) {
      return true;
    }
    if (comment.type !== "Line") {
      return false;
    }
    boundary = comment.start;
  }
  return false;
};

const isExportedDeclaration = (statement: Node): boolean =>
  statement.type === "ExportDefaultDeclaration" ||
  (statement.type === "ExportNamedDeclaration" &&
    statement.declaration !== null);

/** Where a statement starts, a decorator before `export` included. */
const startOf = (statement: Node): number => {
  const declaration =
    statement.type === "ExportNamedDeclaration" ||
    statement.type === "ExportDefaultDeclaration"
      ? statement.declaration
      : null;
  const decorators =
    declaration !== null && "decorators" in declaration
      ? declaration.decorators.map(({ start }) => start)
      : [];
  return Math.min(statement.start, ...decorators);
};

/** The name of an exported function declaration or overload signature, undefined for any other statement. */
const functionNameOf = (statement: Node): string | undefined => {
  if (statement.type !== "ExportNamedDeclaration") {
    return undefined;
  }
  const { declaration } = statement;
  return declaration?.type === "FunctionDeclaration" ||
    declaration?.type === "TSDeclareFunction"
    ? (declaration.id?.name ?? undefined)
    : undefined;
};

/** The exported declarations of the program, an overload's signatures and implementation as one. */
const declarationGroups = (
  body: ReadonlyArray<Node>,
): ReadonlyArray<ReadonlyArray<Node>> => {
  const groups: Node[][] = [];
  let previousName: string | undefined;
  for (const statement of body.filter((node) => isExportedDeclaration(node))) {
    const name = functionNameOf(statement);
    const last = groups.at(-1);
    if (name !== undefined && name === previousName && last !== undefined) {
      last.push(statement);
    } else {
      groups.push([statement]);
    }
    previousName = name;
  }
  return groups;
};

/**
 * The exported declarations of a parse and how many are documented. An
 * overloaded function is one declaration, documented when any of its
 * signatures is.
 */
export const exportsOf = (
  { program, comments }: ParsedSource,
  text: string,
): {
  readonly exportedDeclarations: number;
  readonly documentedExports: number;
} => {
  const groups = declarationGroups(program.body);
  return {
    exportedDeclarations: groups.length,
    documentedExports: groups.filter((group) =>
      group.some((statement) =>
        hasJsdocAbove(comments, text, startOf(statement)),
      ),
    ).length,
  };
};
