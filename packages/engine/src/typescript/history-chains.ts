// Owns which changes of the history the trends replay: the counts of a script and the flags of a project config.
// The chain of the head is kept whole; the chains of absorbed histories keep only those changes.
import type { Effect, FileSystem, Path } from "effect";

import type { GitError } from "../git/git-errors.js";
import type { Git } from "../git/git.js";
import { readChains } from "../history/absorbed/read-chains.js";
import type { ChainsInput } from "../history/absorbed/read-chains.js";
import type { FirstParentCommit } from "../history/first-parent.js";
import { isProjectTsconfigPath } from "../universe/project-files.js";
import { isScriptPath } from "./source-kinds.js";

/** What the replay reads of a change. A change to this rule needs a new `ABSORBED_CACHE_FILE`. */
const isReplayedPath = (path: string): boolean =>
  isScriptPath(path) || isProjectTsconfigPath(path);

/**
 * The first-parent chain of the head with the chains of the histories its
 * merges absorbed (see `readChains`), keeping the replayed changes of the
 * latter. Runs git, which must be in the repository root.
 */
export const readReplayedChains = (
  input: Omit<ChainsInput, "isReplayed">,
): Effect.Effect<
  ReadonlyArray<FirstParentCommit>,
  GitError,
  Git | FileSystem.FileSystem | Path.Path
> => readChains({ ...input, isReplayed: isReplayedPath });
