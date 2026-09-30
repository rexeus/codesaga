// Owns the repository's commits as the analysis reads them: the whole
// non-merge history, with every change under the path its file has today and
// told apart by the life of that path it belongs to.
import { Effect } from "effect";
import type { FileSystem, Path } from "effect";

import type { GitError } from "../git/git-errors.js";
import type { Git } from "../git/git.js";
import { readCommits } from "./commit-log.js";
import type { Commit } from "./parse-log.js";

/** The lines one commit added to and deleted from one file. */
export type FileChange = {
  readonly path: string;
  readonly added: number;
  readonly deleted: number;
  /**
   * Set when the change belongs to an earlier life of the path: the commit
   * deleted the file, or a newer commit deleted the file that had this name
   * then. Absent for the life of the file that exists at the path today.
   */
  readonly previousLife?: true;
};

/** A commit whose changes are named by current paths. */
export type HistoryCommit = Omit<Commit, "changes"> & {
  readonly changes: ReadonlyArray<FileChange>;
};

/** The resolved history and the author time of the commit it was read from. */
export type History = {
  /** Every non-merge commit, newest first, each before its parents. */
  readonly commits: ReadonlyArray<HistoryCommit>;
  /** Author time in seconds of the HEAD commit itself, merge or not; NaN if git cannot read it. */
  readonly headTime: number;
};

export type HistoryOptions = {
  /** The absolute root of the work tree; the `Git` service runs there. */
  readonly root: string;
  /** The commit to read the history of. */
  readonly head: string;
  /**
   * The commits a shallow clone was cut at, or an empty set; they are left
   * out entirely, as their changes say nothing about the files.
   */
  readonly shallowBoundary: ReadonlySet<string>;
  /** Whether parsed commits are read from and written to the history cache. */
  readonly useCache: boolean;
};

/** What the walk from the newest commit has learned about paths. */
type Lineage = {
  /** Old path to the path its file has today. */
  readonly renamedTo: Map<string, string>;
  /**
   * Names a deleted file had in the commits older than its deletion. They are
   * names as each commit wrote them, not current paths: a file renamed onto
   * the path of a deleted one is a different file.
   */
  readonly deletedNames: Set<string>;
};

/**
 * Renames the commit's changes to current paths and marks the ones of a
 * previous life; records the commit's own renames and deletions in `lineage`.
 * A deletion ends the life of the file that had that name in the commit. A
 * file renamed onto a name that is deleted later is that dead file, so its
 * old name ends with it. A rename's old name is otherwise not a deletion, and
 * deleting and re-adding a path in one commit is an edit, as the commit's
 * diff shows it.
 */
const resolveLineage = (commit: Commit, lineage: Lineage): HistoryCommit => {
  const endedNames: Array<string> = [];
  const changes = commit.changes.map((change): FileChange => {
    const path = lineage.renamedTo.get(change.path) ?? change.path;
    const isPrevious =
      change.removed === true || lineage.deletedNames.has(change.path);
    if (change.removed === true) {
      endedNames.push(change.path);
    }
    if (change.renamedFrom !== undefined) {
      lineage.renamedTo.set(change.renamedFrom, path);
      if (isPrevious) {
        endedNames.push(change.renamedFrom);
      }
    }
    const { added, deleted } = change;
    return isPrevious
      ? { path, added, deleted, previousLife: true }
      : { path, added, deleted };
  });
  for (const name of endedNames) {
    lineage.deletedNames.add(name);
  }
  return { ...commit, changes };
};

/**
 * Reads every non-merge commit of `options.head`, each before its parents,
 * author and committer after `.mailmap`. A rename makes every older commit that touched
 * the old path name the new one, so a file keeps its history under its
 * current name; deleted files keep the path they had when they were deleted.
 * A deletion ends the life of the file that had the deleted name: its own
 * change and every older change to that file are marked `previousLife`, so a
 * file created or renamed onto the path later starts fresh.
 *
 * The whole repository's log is read, never a path-limited one: a file moved
 * into the universe from outside keeps the history it had before the move.
 * The parsed log is cached in the git directory (see `readCommits`); renames
 * and deletions are resolved on every call, over the whole list.
 *
 * Git must run in the repository root.
 */
export const readHistory = (
  options: HistoryOptions,
): Effect.Effect<History, GitError, Git | FileSystem.FileSystem | Path.Path> =>
  Effect.map(readCommits(options), (all) => {
    const lineage: Lineage = {
      renamedTo: new Map(),
      deletedNames: new Set(),
    };
    return {
      commits: all
        .filter(
          ({ parents, sha }) =>
            parents.length <= 1 && !options.shallowBoundary.has(sha),
        )
        .map((commit) => resolveLineage(commit, lineage)),
      headTime: all.find(({ sha }) => sha === options.head)?.time ?? 0,
    };
  });

/** The lines the commits added to and deleted from the paths that `isCodePath` accepts. */
export const countCodeLines = (
  commits: ReadonlyArray<Pick<HistoryCommit, "changes">>,
  isCodePath: (path: string) => boolean,
): { readonly added: number; readonly deleted: number } => {
  const changes = commits
    .flatMap((commit) => commit.changes)
    .filter((change) => isCodePath(change.path));
  return {
    added: changes.reduce((sum, change) => sum + change.added, 0),
    deleted: changes.reduce((sum, change) => sum + change.deleted, 0),
  };
};
