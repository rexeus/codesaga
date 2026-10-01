// Owns what besides the commits decides what `git log` prints for them, so a
// cache written under other settings is recognized as stale.
import { Effect, FileSystem, Path } from "effect";

import { Git } from "../git/git.js";
import { LOG_FORMAT_ARGS, PARSER_VERSION } from "./parse-log.js";

const sha256 = (text: string): Effect.Effect<string> =>
  Effect.promise(() =>
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
  ).pipe(
    Effect.map((digest) =>
      Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join(""),
    ),
  );

/** git's stdout, or "" when it exits non-zero, as `config --get` does for an unset key. */
const textOrEmpty = (
  git: Git["Service"],
  args: ReadonlyArray<string>,
): Effect.Effect<string> =>
  git.text(args).pipe(
    Effect.map((output) => output.trim()),
    Effect.orElseSucceed(() => ""),
  );

/**
 * A digest of the log arguments, the parser version, the mailmap (`.mailmap`
 * in the work tree, `mailmap.file`, and the blob `mailmap.blob` names), the
 * replace refs, the grafts file, and the shallow boundary: what git prints for
 * the same head, or how it is read, differs when any of them changes.
 *
 * Runs git inside `root`, so the `Git` service must be built for it.
 */
export const logFingerprint = (
  root: string,
  skipCommits: ReadonlySet<string>,
): Effect.Effect<string, never, Git | FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const git = yield* Git;
    const readOrEmpty = (file: string) =>
      fs
        .readFileString(path.resolve(root, file))
        .pipe(Effect.orElseSucceed(() => ""));
    const graftsFile = yield* textOrEmpty(git, [
      "rev-parse",
      "--git-path",
      "info/grafts",
    ]);
    const mailmapFile = yield* textOrEmpty(git, [
      "config",
      "--type=path",
      "--get",
      "mailmap.file",
    ]);
    const mailmapBlob = yield* textOrEmpty(git, [
      "config",
      "--get",
      "mailmap.blob",
    ]);
    return yield* sha256(
      JSON.stringify({
        args: LOG_FORMAT_ARGS,
        parserVersion: PARSER_VERSION,
        replaceRefs: yield* textOrEmpty(git, [
          "for-each-ref",
          "--format=%(refname) %(objectname)",
          "refs/replace/",
        ]),
        grafts: graftsFile === "" ? "" : yield* readOrEmpty(graftsFile),
        workTreeMailmap: yield* readOrEmpty(".mailmap"),
        mailmapFile,
        mailmapFileContent:
          mailmapFile === "" ? "" : yield* readOrEmpty(mailmapFile),
        mailmapBlob,
        mailmapBlobId:
          mailmapBlob === ""
            ? ""
            : yield* textOrEmpty(git, [
                "rev-parse",
                "--verify",
                "--quiet",
                mailmapBlob,
              ]),
        shallow: [...skipCommits].toSorted(),
      }),
    );
  });
