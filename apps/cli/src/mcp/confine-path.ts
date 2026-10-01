// Owns the rule that a tool call stays inside the repository the server was started in.
import { locateRepository } from "@codesaga/engine";
import { Effect, Schema } from "effect";
import type { FileSystem } from "effect";
import type { ChildProcessSpawner } from "effect/process";

type LocateError = Effect.Error<ReturnType<typeof locateRepository>>;

/** A `path` names a location in another repository than the server's. */
export class PathOutsideServer extends Schema.TaggedError<PathOutsideServer>()(
  "PathOutsideServer",
  { root: Schema.String },
) {}

/** The tool failure line for `error`. */
export const outsideServerMessage = (error: PathOutsideServer): string =>
  `path must be inside ${error.root}; start the server in the other repository to analyze it`;

/**
 * Succeeds when the repository around `target` is the one around `serverCwd`.
 * Both roots come from git, which resolves symlinks, so a link or a nested
 * repository that leads elsewhere is rejected too.
 *
 * Fails with `PathOutsideServer` naming the server's root, or with the git
 * error of whichever directory is no repository.
 */
export const confineToServerRepository = (
  serverCwd: string,
  target: string,
): Effect.Effect<
  void,
  LocateError | PathOutsideServer,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const serverRoot = yield* locateRepository(serverCwd);
    const targetRoot = yield* locateRepository(target);
    return yield* targetRoot === serverRoot
      ? Effect.void
      : Effect.fail(new PathOutsideServer({ root: serverRoot }));
  });
