// Owns running `git blame` over the universe: one process per file, a few at a time.
import { Effect, Stream } from "effect";

import type { GitCommandFailed, GitError } from "../git/git-errors.js";
import { Git } from "../git/git.js";
import { BlameParser, blameArgs } from "./parse-blame.js";
import type { LineAuthors } from "./parse-blame.js";

/** Blame processes at once; each is a git process reading the file's history. */
const BLAME_CONCURRENCY = 8;

/** What blaming the universe left: the authors of the files git blamed, and the files it could not. */
export type Blame = {
  /** The authors of every blamed file, by path. */
  readonly files: ReadonlyMap<string, LineAuthors>;
  /** Files whose blame failed for a reason other than being absent from HEAD. */
  readonly failed: ReadonlySet<string>;
};

/** No file is blamed: nothing to blame, as in a repository without commits. */
export const NO_BLAME: Blame = { files: new Map(), failed: new Set() };

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

/** A file in the index but not in HEAD (staged only) has no lines to blame, which is no failure. */
const isAbsentFromHead = ({ stderr }: GitCommandFailed): boolean =>
  /no such path/iu.test(stderr);

type Outcome = LineAuthors | "absent" | "failed";

const outcomeOf = (file: string): Effect.Effect<Outcome, GitError, Git> =>
  blameFile(file).pipe(
    Effect.catchTag("GitCommandFailed", (error) =>
      Effect.succeed<Outcome>(isAbsentFromHead(error) ? "absent" : "failed"),
    ),
  );

/**
 * Who wrote the lines of `files` at HEAD, ignoring whitespace changes, by
 * author after `.mailmap`. A file that git cannot blame never fails the run:
 * one absent from HEAD is left out silently, any other is listed in `failed`.
 * `GitNotFound` still fails it.
 *
 * Git must run in the work tree root, and HEAD must exist.
 */
export const readBlame = (
  files: ReadonlyArray<string>,
): Effect.Effect<Blame, GitError, Git> =>
  Effect.forEach(files, outcomeOf, { concurrency: BLAME_CONCURRENCY }).pipe(
    Effect.map((outcomes) => {
      const blamed = new Map<string, LineAuthors>();
      const failed = new Set<string>();
      files.forEach((file, index) => {
        const outcome = outcomes[index];
        if (outcome === "failed") {
          failed.add(file);
        } else if (typeof outcome === "object") {
          blamed.set(file, outcome);
        }
      });
      return { files: blamed, failed };
    }),
  );
