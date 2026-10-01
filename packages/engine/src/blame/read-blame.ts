// Owns running `git blame` over the universe: one process per file, a few at a time.
import { Effect, Stream } from "effect";

import type { GitError } from "../git/git-errors.js";
import { Git } from "../git/git.js";
import { BlameParser, blameArgs } from "./parse-blame.js";
import type { LineAuthors } from "./parse-blame.js";

/** Blame processes at once; each is a git process reading the file's history. */
const BLAME_CONCURRENCY = 8;

const blameFile = (file: string): Effect.Effect<LineAuthors, GitError, Git> =>
  Effect.gen(function* () {
    const git = yield* Git;
    const parser = new BlameParser();
    yield* git.stream(blameArgs(file)).pipe(
      Stream.runForEach((chunk) =>
        Effect.sync(() => {
          parser.push(chunk);
        }),
      ),
    );
    return parser.end();
  });

/**
 * Who wrote the lines of `files` at HEAD, ignoring whitespace changes, by
 * author after `.mailmap`. A file that git cannot blame is left out of the
 * result rather than failing the run; `GitNotFound` still fails it.
 *
 * Git must run in the work tree root.
 */
export const readBlame = (
  files: ReadonlyArray<string>,
): Effect.Effect<ReadonlyMap<string, LineAuthors>, GitError, Git> =>
  Effect.forEach(
    files,
    (file) =>
      blameFile(file).pipe(
        Effect.map((authors) => [[file, authors] as const]),
        Effect.catchTag("GitCommandFailed", () => Effect.succeed([])),
      ),
    { concurrency: BLAME_CONCURRENCY },
  ).pipe(Effect.map((entries) => new Map(entries.flat())));
