// Owns counting the non-blank lines of a source text, the measure the universe's `loc`, the minified-file guard and the digest share.

/** The whitespace outside ASCII, besides the space and the run of spaces from U+2000 to U+200A. */
const OTHER_WHITESPACE: ReadonlySet<number> = new Set([
  160, 5760, 8232, 8233, 8239, 8287, 12288, 65279,
]);

/** Whether the code is JavaScript whitespace or a line terminator: what `\s` matches and `trim` removes. */
const isWhitespace = (code: number): boolean => {
  if (code > 32 && code < 160) {
    return false;
  }
  return (
    code === 32 ||
    (code >= 9 && code <= 13) ||
    (code >= 8192 && code <= 8202) ||
    OTHER_WHITESPACE.has(code)
  );
};

/** Whether `text` from `start` up to `end` holds anything but whitespace. */
const hasContent = (text: string, start: number, end: number): boolean => {
  for (let offset = start; offset < end; offset++) {
    if (!isWhitespace(text.codePointAt(offset) ?? 0)) {
      return true;
    }
  }
  return false;
};

/**
 * The lines of `text`, split at `\n` only, that hold something besides
 * whitespace. A text of 25 KB has a few hundred lines, so the scan jumps from
 * newline to newline instead of reading every character.
 */
export const nonBlankLineCount = (text: string): number => {
  let count = 0;
  let start = 0;
  while (start <= text.length) {
    const newline = text.indexOf("\n", start);
    const end = newline === -1 ? text.length : newline;
    count += hasContent(text, start, end) ? 1 : 0;
    start = end + 1;
  }
  return count;
};
