// Owns turning a span of a source text into lines: which line it starts on and how many non-blank lines it covers.
// Offsets are the parser's own, in UTF-16 code units of the text it read.

/** Line questions about one source text. */
export type LineIndex = {
  /** The 1-based line holding the character at `offset`. */
  readonly lineAt: (offset: number) => number;
  /** The non-blank lines the span from `start` up to `end` touches, `end` excluded. */
  readonly nonBlankLines: (start: number, end: number) => number;
};

/** The first offset of each line, and how many non-blank lines come before each. */
const scan = (text: string) => {
  const starts: number[] = [0];
  const nonBlankBefore: number[] = [0];
  let nonBlank = 0;
  let lineHasText = false;
  for (let offset = 0; offset < text.length; offset++) {
    const code = text.codePointAt(offset);
    if (code === 10) {
      nonBlank += lineHasText ? 1 : 0;
      lineHasText = false;
      starts.push(offset + 1);
      nonBlankBefore.push(nonBlank);
    } else if (code !== 32 && code !== 9 && code !== 13) {
      lineHasText = true;
    }
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
