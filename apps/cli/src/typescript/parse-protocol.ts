// Owns what the application and a parse child say to each other over IPC.
// Only small data crosses: sources go in, verdicts come out, never a syntax tree.
import type { FactsResult, SourceText } from "@codesaga/engine";

/** Set to "1" in the environment of a process that `fork` starts to parse; `bin.ts` checks it before the CLI runs. */
export const PARSE_CHILD_ENV = "CODESAGA_PARSE_CHILD";

/** The child's first message: it loaded the parser, or says why it could not. */
export type ChildReady =
  | { readonly type: "ready"; readonly version: string }
  | { readonly type: "unavailable"; readonly reason: string };

/** Sources to parse, answered by one verdict each, in order. */
export type ParseRequest = {
  readonly type: "parse";
  readonly sources: ReadonlyArray<SourceText>;
};

export type ParseReply = {
  readonly type: "verdicts";
  readonly results: ReadonlyArray<FactsResult>;
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
  hasType(value, "parse") && "sources" in value && Array.isArray(value.sources);
