// Owns the TypeScript parser as a service: sources in, facts or skip reasons out.
// The engine decides what a file's facts are; the application provides how files are parsed.

import { Context, Effect } from "effect";

import type {
  DigestResult,
  FactsResult,
  SourceText,
} from "./facts-of-source.js";

/** Whether the parser is there to read files. */
export type ParserStatus =
  | {
      readonly kind: "ready";
      readonly name: string;
      readonly version: string;
    }
  | {
      readonly kind: "unavailable";
      readonly name: string;
      /** Why it did not load, in its own words. */
      readonly reason: string;
    };

/**
 * Reads TypeScript and JavaScript into facts. A layer that cannot load its
 * parser still provides the service, as `unavailableParser`, so that the
 * analysis degrades to a coverage note instead of failing.
 */
export class TypeScriptParser extends Context.Service<
  TypeScriptParser,
  {
    /** Whether the parser loaded; the first call may load it. */
    readonly status: Effect.Effect<ParserStatus>;
    /**
     * One verdict per source, in order. Never fails: a source that cannot be
     * parsed is skipped with a reason, and a parser that did not load skips
     * every source as `parser-unavailable`.
     */
    factsOf(
      sources: ReadonlyArray<SourceText>,
    ): Effect.Effect<ReadonlyArray<FactsResult>>;
    /**
     * The same verdicts with the digest of each file instead of its full
     * facts: what the history keeps of every version of every file, at a
     * fraction of the cost to compute, move and store.
     */
    digestsOf(
      sources: ReadonlyArray<SourceText>,
    ): Effect.Effect<ReadonlyArray<DigestResult>>;
  }
>()("@codesaga/engine/typescript/TypeScriptParser") {}

const UNAVAILABLE: FactsResult<never> = {
  kind: "skipped",
  reason: "parser-unavailable",
};

/** A parser that did not load: every source is skipped as `parser-unavailable`. */
export const unavailableParser = (
  name: string,
  reason: string,
): TypeScriptParser["Service"] =>
  TypeScriptParser.of({
    status: Effect.succeed({ kind: "unavailable", name, reason }),
    factsOf: (sources) => Effect.succeed(sources.map(() => UNAVAILABLE)),
    digestsOf: (sources) => Effect.succeed(sources.map(() => UNAVAILABLE)),
  });
