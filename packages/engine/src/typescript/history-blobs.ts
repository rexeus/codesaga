// Owns which blobs of the history the deep dive reads: every TypeScript and JavaScript
// version a commit changed, and the files of HEAD, which no commit may have touched in a shallow clone.
import { Effect } from "effect";

import type { BlobRef } from "../git/blob-reader.js";
import type { GitError } from "../git/git-errors.js";
import { Git } from "../git/git.js";
import type { FileChange, HistoryCommit } from "../history/history.js";
import { isDeclarationPath, isScriptPath } from "./source-kinds.js";

/** A blob to parse, with the path that tells how to parse it. */
export type HistoryBlob = BlobRef & { readonly path: string };

const isParsable = (path: string): boolean =>
  isScriptPath(path) && !isDeclarationPath(path);

/** `<mode> SP <type> SP <oid> TAB <path>`, as `ls-tree -z` prints an entry. */
const TREE_ENTRY = /^(\d+) \w+ ([0-9a-f]+)\t(.*)$/su;

/**
 * The files of the commit's tree that are parsed, with their blob ids and
 * modes. Runs git, which must be in the repository root.
 */
export const readHeadBlobs = (
  head: string,
): Effect.Effect<ReadonlyArray<HistoryBlob>, GitError, Git> =>
  Effect.gen(function* () {
    const git = yield* Git;
    const listing = yield* git.text(["ls-tree", "-r", "-z", head]);
    return listing.split("\0").flatMap((entry): Array<HistoryBlob> => {
      const [, mode = "", oid = "", path = ""] = TREE_ENTRY.exec(entry) ?? [];
      return oid !== "" && isParsable(path) ? [{ oid, mode, path }] : [];
    });
  });

/** The versions of a file a change names: the one it leaves and the one it replaces. */
const blobsOfChange = (change: FileChange): Array<HistoryBlob> => {
  const { path, oid, mode, previousOid, previousMode } = change;
  const after =
    oid === undefined
      ? []
      : [{ path, oid, ...(mode === undefined ? {} : { mode }) }];
  const before =
    previousOid === undefined
      ? []
      : [
          {
            path,
            oid: previousOid,
            ...(previousMode === undefined ? {} : { mode: previousMode }),
          },
        ];
  return [...after, ...before];
};

/**
 * The distinct blobs of the changes' TypeScript and JavaScript files, before
 * and after each commit, and of `head`; declaration files are left out. A blob
 * that several paths hold is named by the first path met.
 */
export const blobsOfHistory = (
  commits: ReadonlyArray<Pick<HistoryCommit, "changes">>,
  head: ReadonlyArray<HistoryBlob>,
): ReadonlyArray<HistoryBlob> => {
  const blobs = new Map<string, HistoryBlob>();
  const changed = commits
    .flatMap(({ changes }) => changes)
    .filter(({ path }) => isParsable(path))
    .flatMap((change) => blobsOfChange(change));
  for (const blob of [...changed, ...head]) {
    if (!blobs.has(blob.oid)) {
      blobs.set(blob.oid, blob);
    }
  }
  return [...blobs.values()];
};
