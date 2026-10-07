// Owns how the engine reports the progress of a long parse, without knowing who listens.
import { Context, Effect } from "effect";

/** Receives the progress of parsing the history's file versions. */
export type ParseProgressReport = {
  /**
   * Called once before the first batch with nothing done, so that a listener
   * can start its clock, and after every batch with the file versions done so
   * far out of `total`; the parse is over when `done` reaches `total`.
   */
  readonly update: (done: number, total: number) => Effect.Effect<void>;
};

/** Nobody listens unless the application provides a report. */
export const ParseProgress = Context.Reference<ParseProgressReport>(
  "@codesaga/engine/typescript/ParseProgress",
  { defaultValue: () => ({ update: () => Effect.void }) },
);
