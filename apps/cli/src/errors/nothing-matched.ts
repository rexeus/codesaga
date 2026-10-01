import { Schema } from "effect";

/** `inspect` was given patterns and none of them matched a universe file. */
export class NothingMatched extends Schema.TaggedError<NothingMatched>()(
  "NothingMatched",
  { patterns: Schema.Array(Schema.String) },
) {}

/** The one-line wording for patterns that matched nothing; the caller escapes it for the terminal. */
export const noFileMatches = (patterns: ReadonlyArray<string>): string =>
  `no file matches ${patterns.map((pattern) => `"${pattern}"`).join(", ")} (patterns are relative to the repository root)`;
