// Tests only: gathering the history's facts against a temporary repository, with the real parser
// counting what it is given and git recording which blobs were read.
import { Effect, Layer } from "effect";

import { Git } from "../git/git.js";
import { readHistory } from "../history/history.js";
import {
  digestOfSource,
  factsOfSource,
} from "../typescript/facts-of-source.js";
import { gatherHistoryFacts } from "../typescript/history-facts.js";
import { ParseProgress } from "../typescript/parse-progress.js";
import { TypeScriptParser } from "../typescript/typescript-parser.js";
import { oxcParse } from "./oxc-parser.js";
import type { TempRepository } from "./temp-repository.js";

/** The real parser, which records how many sources each call was given. */
export const countingParser = (version = "1") => {
  const calls: Array<number> = [];
  const layer = Layer.succeed(
    TypeScriptParser,
    TypeScriptParser.of({
      status: Effect.succeed({ kind: "ready", name: "oxc-parser", version }),
      factsOf: (sources) =>
        Effect.sync(() => {
          calls.push(sources.length);
          return sources.map((source) => factsOfSource(oxcParse, source));
        }),
      digestsOf: (sources) =>
        Effect.sync(() => {
          calls.push(sources.length);
          return sources.map((source) => digestOfSource(oxcParse, source));
        }),
    }),
  );
  return { layer, parsed: () => calls.reduce((sum, count) => sum + count, 0) };
};

/** Git as it is, recording the blob ids sent to `cat-file --batch`; `progress` records each `ParseProgress` update. */
export const recordingServices = (repo: TempRepository) => {
  const read: Array<string> = [];
  const progress: Array<readonly [number, number]> = [];
  const layer = Layer.mergeAll(
    Layer.effect(
      Git,
      Effect.map(Git.make(repo.directory), (real) =>
        Git.of({
          ...real,
          bytes: (args, stdin) => {
            if (args[0] === "cat-file" && stdin !== undefined) {
              read.push(...stdin.trim().split("\n"));
            }
            return real.bytes(args, stdin);
          },
        }),
      ),
    ),
    Layer.succeed(ParseProgress, {
      update: (done, total) =>
        Effect.sync(() => {
          progress.push([done, total]);
        }),
    }),
  );
  return { layer, read, progress };
};

type GatherOptions = {
  readonly useCache?: boolean;
  readonly include?: ReadonlyArray<string>;
  readonly exclude?: ReadonlyArray<string>;
};

/** `gatherHistoryFacts` for the whole history of the repository's HEAD; the caller provides the parser and `recordingServices`. */
export const gatherOf = (repo: TempRepository, options: GatherOptions = {}) =>
  Effect.gen(function* () {
    const head = (yield* repo.git("rev-parse", "HEAD")).trim();
    const { commits } = yield* readHistory({
      root: repo.directory,
      head,
      shallowBoundary: new Set(),
      useCache: false,
    });
    return yield* gatherHistoryFacts({
      root: repo.directory,
      head,
      commits,
      include: options.include ?? [],
      exclude: options.exclude ?? [],
      useCache: options.useCache ?? true,
    });
  });
