// Owns reading the `tsconfig*.json` files of the first-parent chain: every version a commit on it changed.
// They are read as text, not parsed, so the trends can follow what a config effectively sets over time.
import { Effect, Stream } from "effect";

import { readBlobs, skipBeforeReading } from "../git/blob-reader.js";
import type { BlobRef } from "../git/blob-reader.js";
import type { GitError } from "../git/git-errors.js";
import type { Git } from "../git/git.js";
import type { FirstParentCommit } from "../history/first-parent.js";
import { isProjectTsconfigPath } from "../universe/project-files.js";

const refOf = (
  oid: string | undefined,
  mode: string | undefined,
): BlobRef | undefined =>
  oid === undefined
    ? undefined
    : { oid, ...(mode === undefined ? {} : { mode }) };

/**
 * The text of every version of the project's `tsconfig*.json` files that the
 * commits change, before and after, by blob id; a version that is not text
 * (a symlink, a blob git does not have) is absent. Git must run in the
 * repository root.
 */
export const readConfigTexts = (
  chain: ReadonlyArray<FirstParentCommit>,
): Effect.Effect<ReadonlyMap<string, string>, GitError, Git> =>
  Effect.gen(function* () {
    const refs = chain
      .flatMap(({ changes }) => changes)
      .filter(({ path }) => isProjectTsconfigPath(path))
      .flatMap(({ oid, mode, previousOid, previousMode }) => [
        refOf(oid, mode),
        refOf(previousOid, previousMode),
      ])
      .flatMap((ref) =>
        ref !== undefined && skipBeforeReading(ref) === undefined ? [ref] : [],
      );
    const distinct = new Map(refs.map((ref) => [ref.oid, { oid: ref.oid }]));
    const reads = yield* Stream.runCollect(readBlobs([...distinct.values()]));
    return new Map(
      [...reads].flatMap((read) =>
        "text" in read ? [[read.oid, read.text] as const] : [],
      ),
    );
  });
