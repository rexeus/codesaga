// Owns reading what a commit message says: the trailer block git parsed and the
// body lines that name a tool or an agent co-author.

const TRAILER_SEPARATOR = "\u001F";
const GENERATED_WITH = /^\W*Generated with \[[^\]]+\]/iu;
const CO_AUTHOR_LINE = /^co-authored-by:\s*([^<>]*<[^<>]+>)\s*$/iu;

/** One `Key: value` line of a commit's trailer block. */
export type Trailer = { readonly key: string; readonly value: string };

const collapse = (text: string): string => text.replaceAll(/\s+/gu, " ").trim();

/** Reads git's unfolded trailer field (`%(trailers:unfold,separator=%x1f)`), whitespace collapsed. */
export const parseTrailers = (field: string): ReadonlyArray<Trailer> =>
  field
    .split(TRAILER_SEPARATOR)
    .map((line) => [line.indexOf(":"), line] as const)
    .filter(([colon]) => colon > 0)
    .map(([colon, line]) => ({
      key: line.slice(0, colon).trim(),
      value: collapse(line.slice(colon + 1)),
    }));

const isUnparsedCoAuthor = (
  line: string,
  trailers: ReadonlyArray<Trailer>,
): boolean => {
  const value = CO_AUTHOR_LINE.exec(line)?.[1];
  return (
    value !== undefined &&
    !trailers.some(
      (trailer) =>
        trailer.key.toLowerCase() === "co-authored-by" &&
        trailer.value === collapse(value),
    )
  );
};

/**
 * The trimmed message lines that name a tool ("Generated with [Claude Code](...)")
 * or carry a `Co-authored-by: Name <email>` that is not among the parsed
 * `trailers`, as in a squash-merge body that git leaves unparsed.
 */
export const parseMarkers = (
  message: string,
  trailers: ReadonlyArray<Trailer>,
): ReadonlyArray<string> =>
  message
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) => GENERATED_WITH.test(line) || isUnparsedCoAuthor(line, trailers),
    );
