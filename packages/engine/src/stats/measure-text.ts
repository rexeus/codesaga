// Owns measuring the text of one source file in a single pass: its lines, indentation, line lengths and comments.
// The facts are what the report's stats add up over any set of files; nothing here knows about territories.

import { commentCounter } from "./comments.js";
import type { CommentSyntax } from "./comments.js";
import type { Tally } from "./distribution.js";
import { detectIndentUnit, levelOf } from "./indentation.js";

/** What reading a file's text revealed, over its non-blank lines. */
export type TextMeasure = {
  /** Non-blank lines. */
  readonly loc: number;
  /** The sum of the indentation levels of all lines (codeheat's complexity total). */
  readonly levels: number;
  /** The deepest indentation level of any line. */
  readonly deepestLevel: number;
  /** How many lines have each length, trailing whitespace not counted. */
  readonly lineLengths: Tally;
  readonly commentLines: number;
  /** Lines that start with a tab. */
  readonly tabIndented: number;
  /** Lines that start with a space, except the continuation lines of a block comment, whose ` * ` aligns the asterisks. */
  readonly spaceIndented: number;
  /** The width of one indentation level in spaces, as `detectIndentUnit` finds it for the file. */
  readonly indentWidth: number;
};

const TAB = 9;
const SPACE = 32;
const MAX_ASCII = 127;
const UNICODE_WHITESPACE = /\s/u;

/** The code point of `line` at `index`, or 0 past its end. */
const codeAt = (line: string, index: number): number =>
  line.codePointAt(index) ?? 0;

/** Whether the code point is whitespace as `String.prototype.trim` sees it. */
const isWhitespace = (code: number): boolean =>
  code === SPACE ||
  (code >= TAB && code <= 13) ||
  (code > MAX_ASCII && UNICODE_WHITESPACE.test(String.fromCodePoint(code)));

/** The end of `line` without its trailing whitespace, but not before `start`. */
const trimmedEnd = (line: string, start: number): number => {
  let end = line.length;
  while (end > start && isWhitespace(codeAt(line, end - 1))) {
    end -= 1;
  }
  return end;
};

/** What the first loop over a file's lines collects; the levels need the indentation width, which needs all lines. */
type Lines = {
  readonly loc: number;
  readonly leadingTabs: Int32Array;
  readonly leadingSpaces: Int32Array;
  readonly lineLengths: Map<number, number>;
  readonly commentLines: number;
  readonly tabIndented: number;
  readonly spaceIndented: number;
};

/** The position of the first character of `line` that is no tab or space, and how many of the characters before it are tabs. */
const leadingWhitespace = (
  line: string,
): { readonly start: number; readonly tabs: number } => {
  let tabs = 0;
  let start = 0;
  for (;;) {
    const code = codeAt(line, start);
    if (code === TAB) {
      tabs += 1;
    } else if (code !== SPACE) {
      return { start, tabs };
    }
    start += 1;
  }
};

/** A tight loop over the lines, because every file of the universe is measured while it is read. */
const readLines = (text: string, syntax: CommentSyntax): Lines => {
  const comments = commentCounter(syntax);
  const lineLengths = new Map<number, number>();
  const lines = text.split("\n");
  const leadingTabs = new Int32Array(lines.length);
  const leadingSpaces = new Int32Array(lines.length);
  let loc = 0;
  let tabIndented = 0;
  let spaceIndented = 0;
  for (const line of lines) {
    const { start, tabs } = leadingWhitespace(line);
    const end = trimmedEnd(line, start);
    if (end === start) {
      continue;
    }
    leadingTabs[loc] = tabs;
    leadingSpaces[loc] = start - tabs;
    loc += 1;
    lineLengths.set(end, (lineLengths.get(end) ?? 0) + 1);
    const continuesComment = comments.add(line, start);
    tabIndented += codeAt(line, 0) === TAB ? 1 : 0;
    spaceIndented += !continuesComment && codeAt(line, 0) === SPACE ? 1 : 0;
  }
  return {
    loc,
    leadingTabs,
    leadingSpaces,
    lineLengths,
    commentLines: comments.count(),
    tabIndented,
    spaceIndented,
  };
};

/** Measures `text`; blank and whitespace-only lines are skipped. */
export const measureText = (
  text: string,
  syntax: CommentSyntax,
): TextMeasure => {
  const { leadingTabs, leadingSpaces, ...lines } = readLines(text, syntax);
  const indentWidth = detectIndentUnit(leadingSpaces.subarray(0, lines.loc));
  let levels = 0;
  let deepestLevel = 0;
  for (let index = 0; index < lines.loc; index++) {
    const level = levelOf(
      leadingTabs[index] ?? 0,
      leadingSpaces[index] ?? 0,
      indentWidth,
    );
    levels += level;
    deepestLevel = Math.max(deepestLevel, level);
  }
  return { ...lines, levels, deepestLevel, indentWidth };
};
