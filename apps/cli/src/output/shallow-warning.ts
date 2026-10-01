// Owns the one diagnostic for history a shallow clone does not have.
import { Console, Effect } from "effect";

/** Prints a one-line warning to stderr when the result was made from a shallow clone. */
export const warnIfShallow = (shallow: boolean): Effect.Effect<void> =>
  shallow
    ? Console.error(
        "codesaga: shallow clone: history before its oldest fetched commit is missing; run git fetch --unshallow for full results",
      )
    : Effect.void;
