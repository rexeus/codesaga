// Owns the one diagnostic for files `git blame` failed on.
import { Console, Effect } from "effect";

/**
 * Prints a one-line warning to stderr when blame failed for some files.
 * `lineOwners` is the scope's, or all matches', figure; absent without `--blame`.
 */
export const warnIfBlameSkipped = (
  lineOwners: { readonly skippedFiles: number } | undefined,
): Effect.Effect<void> => {
  const skipped = lineOwners?.skippedFiles ?? 0;
  return skipped === 0
    ? Effect.void
    : Console.error(
        `codesaga: git blame failed for ${skipped} ${skipped === 1 ? "file" : "files"}; line owners cover the rest`,
      );
};
