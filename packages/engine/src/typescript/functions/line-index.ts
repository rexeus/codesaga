// Owns turning a span of a source text into lines: which line it starts on and how many non-blank lines it covers.
// Offsets are the parser's own, in UTF-16 code units of the text it read.

/** Line questions about one source text. */
export type LineIndex = {
  /** The 1-based line holding the character at `offset`. */
  readonly lineAt: (offset: number) => number;
  /** The non-blank lines the span from `start` up to `end` touches, `end` excluded. */
  readonly nonBlankLines: (start: number, end: number) => number;
};

/** Whether a code unit is no content of a line: a space, a tab or a carriage return. */
const isBlankUnit = (unit: number): boolean =>
  unit === 32 || unit === 9 || unit === 13;

const hasText = (text: string, start: number, end: number): boolean => {
  for (let offset = start; offset < end; offset++) {
    if (!isBlankUnit(text.codePointAt(offset) ?? 0)) {
      return true;
    }
  }
  return false;
};

/** The first offset of each line, and how many non-blank lines come before each. */
const scan = (text: string) => {
  const starts: number[] = [0];
  const nonBlankBefore: number[] = [0];
  let nonBlank = 0;
  let lineHasText = false;
  let start = 0;
  for (;;) {
    const newline = text.indexOf("\n", start);
    const end = newline === -1 ? text.length : newline;
    lineHasText = hasText(text, start, end);
    if (newline === -1) {
      break;
    }
    nonBlank += lineHasText ? 1 : 0;
    lineHasText = false;
    starts.push(end + 1);
    nonBlankBefore.push(nonBlank);
    start = end + 1;
  }
  return { starts, nonBlankBefore, nonBlank, lineHasText };
};

/** The index of `text`; the scan is deferred to the first question, since many files have no function. */
export const lineIndexOf = (text: string): LineIndex => {
  let scanned: ReturnType<typeof scan> | undefined;
  const lines = () => (scanned ??= scan(text));
  /** The 0-based index of the last line that starts at or before `offset`. */
  const indexAt = (offset: number): number => {
    const { starts } = lines();
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if ((starts[middle] ?? 0) <= offset) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }
    return low;
  };
  return {
    lineAt: (offset) => indexAt(offset) + 1,
    nonBlankLines: (start, end) => {
      const { nonBlankBefore, nonBlank, lineHasText } = lines();
      const first = indexAt(start);
      const last = indexAt(Math.max(start, end - 1));
      const before = (line: number): number =>
        line < nonBlankBefore.length
          ? (nonBlankBefore[line] ?? 0)
          : nonBlank + (lineHasText ? 1 : 0);
      return before(last + 1) - before(first);
    },
  };
};
