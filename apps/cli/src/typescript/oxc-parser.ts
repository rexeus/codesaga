// Owns the TypeScript parser the application ships: oxc-parser in a small pool of child processes.
// oxc-parser is the one external dependency of the bundle, because its native binding cannot be bundled, and it can crash its process on hostile input, so no parse runs in the application's own process.
import { availableParallelism } from "node:os";

import { TypeScriptParser, unavailableParser } from "@codesaga/engine";
import { Effect, Layer } from "effect";

import { forkWorker } from "./child-worker.js";
import type { ChildCommand } from "./child-worker.js";
import { makePool } from "./parse-pool.js";
import type { PoolReadiness } from "./parse-pool.js";

const PARSER_NAME = "oxc-parser";
/** Children parsing at once; each holds up to a few hundred MB while it parses. */
const MAX_PARSE_PROCESSES = 4;

/** One process fewer than the cores, so the application keeps one, and at least one. */
const poolSize = (): number =>
  Math.max(1, Math.min(MAX_PARSE_PROCESSES, availableParallelism() - 1));

/** The command that runs this very program again: the file node started, with the flags it started with. */
export const currentProgram = (): ChildCommand => ({
  entry: process.argv[1] ?? "",
  execArgv: process.execArgv,
});

const statusOf = (readiness: PoolReadiness) =>
  readiness.kind === "ready"
    ? ({
        kind: "ready",
        name: PARSER_NAME,
        version: readiness.version,
      } as const)
    : ({
        kind: "unavailable",
        name: PARSER_NAME,
        reason: readiness.reason,
      } as const);

/**
 * The oxc-backed `TypeScriptParser`: sources are parsed in up to four child
 * processes started from `program`, and a source that crashes the parser is
 * skipped as `parser-crashed` while the rest are still parsed. The first child
 * starts when a command first asks for facts, so `inspect` and `--help` never
 * pay for it, and a child that cannot load oxc-parser or its platform binding
 * makes the parser `unavailable` instead of failing the run. The children end
 * with the layer's scope.
 */
export const makeOxcParserLayer = (program: ChildCommand) =>
  Layer.effect(
    TypeScriptParser,
    Effect.gen(function* () {
      const pool = makePool(() => forkWorker(program), poolSize());
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          pool.stop();
        }),
      );
      const readiness = yield* Effect.cached(
        Effect.promise(() => pool.ready()),
      );
      return TypeScriptParser.of({
        status: Effect.map(readiness, statusOf),
        factsOf: (sources) =>
          Effect.flatMap(readiness, (state) =>
            state.kind === "ready"
              ? Effect.promise(() => pool.factsOf(sources))
              : unavailableParser(PARSER_NAME, state.reason).factsOf(sources),
          ),
      });
    }),
  );
