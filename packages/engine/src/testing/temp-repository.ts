// Tests only: a real git repository in a temporary directory, isolated from
// the machine's git configuration, with commits at fixed dates.
import { Effect, FileSystem, Path } from "effect";
import type { PlatformError, Scope } from "effect";
import type { ChildProcessSpawner } from "effect/process";

import { Git } from "../git/git.js";
import { setScopedEnv } from "./scoped-env.js";

/** What a test chooses about a commit besides its files and date. */
type Person = { readonly name: string; readonly email: string };

type CommitOptions = {
  /** Defaults to the repository's configured user. */
  readonly author?: Person;
  /** Defaults to the repository's configured user, not to the author. */
  readonly committer?: Person;
  /** The whole message, trailers included; defaults to "test". */
  readonly message?: string;
};

export type TempRepository = {
  readonly directory: string;
  /** Runs `git <args>` in the repository and returns its stdout; a failure is a defect. */
  readonly git: (...args: ReadonlyArray<string>) => Effect.Effect<string>;
  /**
   * Writes `files` (relative path to content, creating directories), stages
   * every change in the work tree, and commits at `date` (ISO 8601).
   * `date` keeps its UTC offset as the author date, such as `+05:30`.
   * Commits even when nothing changed.
   */
  readonly commit: (
    date: string,
    files?: Readonly<Record<string, string | Uint8Array>>,
    options?: CommitOptions,
  ) => Effect.Effect<void>;
};

const personEnv = (
  role: "AUTHOR" | "COMMITTER",
  person: Person | undefined,
): Record<string, string> =>
  person === undefined
    ? {}
    : {
        [`GIT_${role}_NAME`]: person.name,
        [`GIT_${role}_EMAIL`]: person.email,
      };

/**
 * Creates a repository that is deleted when the scope closes.
 *
 * Git configuration of the machine is ignored for the scope's lifetime, also
 * for git processes the code under test starts.
 */
export const makeTempRepository: Effect.Effect<
  TempRepository,
  PlatformError.PlatformError,
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner
  | Scope.Scope
> = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* setScopedEnv({
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
  });
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "codesaga-" });
  const git = yield* Git.make(directory);
  const run = (...args: ReadonlyArray<string>) =>
    git.text(args).pipe(Effect.orDie);

  yield* run("init", "--quiet");
  yield* run("config", "user.name", "Codesaga Test");
  yield* run("config", "user.email", "test@codesaga.invalid");
  yield* run("config", "commit.gpgsign", "false");

  const write = (file: string, content: string | Uint8Array) =>
    Effect.gen(function* () {
      const target = path.join(directory, file);
      yield* fs.makeDirectory(path.dirname(target), { recursive: true });
      yield* fs.writeFile(
        target,
        typeof content === "string"
          ? new TextEncoder().encode(content)
          : content,
      );
    });

  const commit = (
    date: string,
    files: Readonly<Record<string, string | Uint8Array>> = {},
    options: CommitOptions = {},
  ) =>
    Effect.scoped(
      Effect.gen(function* () {
        for (const [file, content] of Object.entries(files)) {
          yield* write(file, content);
        }
        yield* setScopedEnv({
          GIT_AUTHOR_DATE: date,
          GIT_COMMITTER_DATE: date,
          ...personEnv("AUTHOR", options.author),
          ...personEnv("COMMITTER", options.committer),
        });
        yield* run("add", "--all");
        yield* run(
          "commit",
          "--quiet",
          "--allow-empty",
          "--message",
          options.message ?? "test",
        );
      }),
    ).pipe(Effect.orDie);

  return { directory, git: run, commit };
});
