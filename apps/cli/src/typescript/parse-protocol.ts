// Owns what the application and a parse child say to each other over IPC.
// Only small data crosses: sources go in, verdicts come out, never a syntax tree.
import type { FactsResult, SourceText } from "@codesaga/engine";

/** Set to "1" in the environment of a process that `fork` starts to parse; `bin.ts` checks it before the CLI runs. */
export const PARSE_CHILD_ENV = "CODESAGA_PARSE_CHILD";

/** The child's first message: it loaded the parser, or says why it could not. */
export type ChildReady =
  | { readonly type: "ready"; readonly version: string }
  | { readonly type: "unavailable"; readonly reason: string };

/** What a verdict holds: the full facts of a file at HEAD, or the digest the history keeps of each version. */
export type ParseKind = "facts" | "digest";

/** Sources to parse, answered by one verdict each, in order. */
export type ParseRequest = {
  readonly type: "parse";
  readonly kind: ParseKind;
  readonly sources: ReadonlyArray<SourceText>;
};

/** The verdicts of a `ParseRequest`; their facts are checked by whoever asked, as nothing here knows their shape. */
export type ParseReply = {
  readonly type: "verdicts";
  readonly results: ReadonlyArray<FactsResult<unknown>>;
};

const hasType = (value: unknown, type: string): value is { type: string } =>
  typeof value === "object" &&
  value !== null &&
  "type" in value &&
  value.type === type;

export const isChildReady = (value: unknown): value is ChildReady =>
  (hasType(value, "ready") &&
    "version" in value &&
    typeof value.version === "string") ||
  (hasType(value, "unavailable") &&
    "reason" in value &&
    typeof value.reason === "string");

export const isParseReply = (value: unknown): value is ParseReply =>
  hasType(value, "verdicts") &&
  "results" in value &&
  Array.isArray(value.results);

export const isParseRequest = (value: unknown): value is ParseRequest =>
  hasType(value, "parse") &&
  "kind" in value &&
  (value.kind === "facts" || value.kind === "digest") &&
  "sources" in value &&
  Array.isArray(value.sources);
