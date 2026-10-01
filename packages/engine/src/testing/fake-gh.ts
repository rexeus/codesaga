// Tests only: a stand-in for the `gh` CLI first on PATH, so no test reads the machine's GitHub login.
import { Effect, FileSystem, Path } from "effect";
import type { PlatformError, Scope } from "effect";

import { setScopedEnv } from "./scoped-env.js";

/**
 * Puts a fake `gh` first on PATH for the scope. Logged in, `gh auth token
 * --hostname <host>` prints `gh-token-for-<host>`; logged out, every call fails.
 */
export const installFakeGh = (
  state: "logged-in" | "logged-out",
): Effect.Effect<
  void,
  PlatformError.PlatformError,
  FileSystem.FileSystem | Path.Path | Scope.Scope
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const bin = yield* fs.makeTempDirectoryScoped({ prefix: "codesaga-gh-" });
    const script = path.join(bin, "gh");
    yield* fs.writeFileString(
      script,
      state === "logged-in"
        ? '#!/bin/sh\n[ "$1 $2 $3" = "auth token --hostname" ] && echo "gh-token-for-$4"\n'
        : "#!/bin/sh\nexit 1\n",
    );
    yield* fs.chmod(script, 0o755);
    yield* setScopedEnv({ PATH: `${bin}:${process.env["PATH"] ?? ""}` });
  });
