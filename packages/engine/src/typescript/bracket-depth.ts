// Owns the cheap pre-scan that keeps hostile nesting away from the native parser.
// A segfault cannot be caught, so the depth is judged on the text before any parse.

type Mode =
  | "code"
  | "single-quoted"
  | "double-quoted"
  | "line-comment"
  | "block-comment";

type Scan = {
  mode: Mode;
  depth: number;
  /** Open generic `<` since the last statement boundary; `<` and `>` also compare. */
  angle: number;
  deepest: number;
};

const OPENING = "([{";
const CLOSING = ")]}";
const IDENTIFIER_CHARACTER = /[\w$]/u;

const record = (scan: Scan): void => {
  scan.deepest = Math.max(scan.deepest, scan.depth + scan.angle);
};

const bracket = (scan: Scan, char: string): void => {
  if (OPENING.includes(char)) {
    scan.depth += 1;
    record(scan);
  } else {
    scan.depth = Math.max(0, scan.depth - 1);
  }
  if (char === "{" || char === "}") {
    scan.angle = 0;
  }
};

/** A `<` right after an identifier opens a generic; a `>` that is not part of `=>` closes one. */
const angleBracket = (scan: Scan, text: string, index: number): void => {
  const before = text.charAt(index - 1);
  if (text.charAt(index) === "<") {
    if (IDENTIFIER_CHARACTER.test(before)) {
      scan.angle += 1;
      record(scan);
    }
  } else if (before !== "=" && scan.angle > 0) {
    scan.angle -= 1;
  }
};

/** Enters a string or a comment at `index` and returns the index of the last character it used. */
const enterLiteral = (scan: Scan, text: string, index: number): number => {
  const char = text.charAt(index);
  if (char === "'") {
    scan.mode = "single-quoted";
  } else if (char === '"') {
    scan.mode = "double-quoted";
  } else if (text.startsWith("//", index)) {
    scan.mode = "line-comment";
    return index + 1;
  } else if (text.startsWith("/*", index)) {
    scan.mode = "block-comment";
    return index + 1;
  }
  return index;
};

const stepCode = (scan: Scan, text: string, index: number): number => {
  const char = text.charAt(index);
  if (OPENING.includes(char) || CLOSING.includes(char)) {
    bracket(scan, char);
  } else if (char === "<" || char === ">") {
    angleBracket(scan, text, index);
  } else if (char === ";") {
    scan.angle = 0;
  } else if (char === "\\") {
    return index + 1;
  } else if (char === "'" || char === '"' || char === "/") {
    return enterLiteral(scan, text, index);
  }
  return index;
};

const stepQuoted = (scan: Scan, text: string, index: number): number => {
  const char = text.charAt(index);
  const quote = scan.mode === "single-quoted" ? "'" : '"';
  if (char === "\\" && text.charAt(index + 1) !== "\n") {
    return index + 1;
  }
  // A quote can lie in a template or a regular expression, where it opens no
  // string, so a line break always ends the string and the scan heals itself.
  if (char === quote || char === "\n") {
    scan.mode = "code";
  }
  return index;
};

const stepComment = (scan: Scan, text: string, index: number): number => {
  if (scan.mode === "line-comment") {
    if (text.charAt(index) === "\n") {
      scan.mode = "code";
    }
    return index;
  }
  if (text.startsWith("*/", index)) {
    scan.mode = "code";
    return index + 1;
  }
  return index;
};

const stepOf = (scan: Scan, text: string, index: number): number => {
  if (scan.mode === "code") {
    return stepCode(scan, text, index);
  }
  return scan.mode === "single-quoted" || scan.mode === "double-quoted"
    ? stepQuoted(scan, text, index)
    : stepComment(scan, text, index);
};

/**
 * The deepest nesting of `(`, `[`, `{` and generic `<` in one pass over the
 * text, ignoring strings and comments so that a lone bracket in a message does
 * not add up over a large file. It reads the text the way a lexer does at
 * most roughly; a crafted file can hide its nesting from it, which only
 * process isolation would stop.
 */
export const deepestNesting = (text: string): number => {
  const scan: Scan = { mode: "code", depth: 0, angle: 0, deepest: 0 };
  for (let index = 0; index < text.length; index += 1) {
    index = stepOf(scan, text, index);
  }
  return scan.deepest;
};
