// Owns reading JSON with comments and trailing commas, the dialect of `tsconfig.json`.
// It tolerates what TypeScript tolerates and nothing else; anything it cannot read is undefined, never a guess.

/** A string literal, which must survive, or a comment, which must not. */
const STRINGS_AND_COMMENTS =
  /("(?:[^"\\]|\\.)*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//gu;
/** A string literal, or a comma that only a closing bracket follows. */
const STRINGS_AND_TRAILING_COMMAS = /("(?:[^"\\]|\\.)*")|,(\s*[}\]])/gu;

/**
 * The value of a JSON-with-comments text, or undefined when it does not
 * parse. A byte order mark, line and block comments and trailing commas are
 * allowed.
 */
export const parseJsonc = (text: string): unknown => {
  const withoutComments = text
    .replace(/^\uFEFF/u, "")
    .replace(
      STRINGS_AND_COMMENTS,
      (_match, string: string | undefined) => string ?? " ",
    );
  const json = withoutComments.replace(
    STRINGS_AND_TRAILING_COMMAS,
    (_match, string: string | undefined, closing: string | undefined) =>
      string ?? closing ?? "",
  );
  try {
    const value: unknown = JSON.parse(json);
    return value;
  } catch {
    return undefined;
  }
};
