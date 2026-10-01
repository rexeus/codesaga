// Owns the shape of `.codesaga.json` and decoding its text.
// A new key is one more field of `RepoConfig`; the decoder rejects every key it does not list.
import { Result, Schema, SchemaIssue } from "effect";

const Matcher = Schema.Trim.check(Schema.isNonEmpty());

/**
 * An in-house tool, matched exactly and case-insensitively on any of its
 * emails or names. An empty matcher would match authors without an email or
 * name, so entries are trimmed and non-empty, and at least one must exist.
 */
const Signature = Schema.Struct({
  name: Schema.NonEmptyString,
  emails: Schema.optionalKey(Schema.Array(Matcher)),
  names: Schema.optionalKey(Schema.Array(Matcher)),
}).check(
  Schema.makeFilter(
    ({ emails = [], names = [] }) =>
      emails.length + names.length > 0 ||
      "Expected at least one entry in emails or names",
  ),
);

const RepoConfig = Schema.Struct({
  include: Schema.optionalKey(Schema.Array(Schema.String)),
  exclude: Schema.optionalKey(Schema.Array(Schema.String)),
  since: Schema.optionalKey(Schema.String),
  limit: Schema.optionalKey(Schema.Natural),
  signatures: Schema.optionalKey(
    Schema.Struct({
      bots: Schema.optionalKey(Schema.Array(Signature)),
      agents: Schema.optionalKey(Schema.Array(Signature)),
    }),
  ),
});

/** The defaults a repository sets for its analyses; every key is optional. */
export type RepoConfig = (typeof RepoConfig)["Type"];

const decodeText = Schema.decodeUnknownResult(
  Schema.fromJsonString(RepoConfig),
  {
    onExcessProperty: "error",
    errors: "all",
  },
);

const formatProblems = SchemaIssue.makeFormatterStandardSchemaV1({
  leafHook: (issue) =>
    issue._tag === "UnexpectedKey"
      ? "unknown key"
      : SchemaIssue.defaultLeafHook(issue),
});

const keyPath = (
  path: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>,
): string =>
  path.reduce<string>((text, segment) => {
    const key = typeof segment === "object" ? segment.key : segment;
    if (typeof key === "number") {
      return `${text}[${key}]`;
    }
    return text === "" ? String(key) : `${text}.${String(key)}`;
  }, "");

/**
 * Decodes the text of a config file. Fails with one line per problem, each
 * led by the key path it concerns: invalid JSON, an unknown key, or a value of
 * the wrong type.
 */
export const decodeRepoConfig = (
  text: string,
): Result.Result<RepoConfig, ReadonlyArray<string>> =>
  Result.mapError(decodeText(text), ({ issue }) =>
    formatProblems(issue).issues.map(({ path = [], message }) =>
      path.length === 0 ? message : `${keyPath(path)}: ${message}`,
    ),
  );
