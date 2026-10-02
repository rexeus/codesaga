// Owns the progress line on a terminal while the history's TypeScript is parsed for the first time.
// It is written to stderr, never stdout, and only when stderr is a terminal.
import { ParseProgress } from "@codesaga/engine";
import { Clock, Effect, Layer } from "effect";

/** At most ten updates a second. */
const MIN_INTERVAL_MS = 100;
/** Back to the start of the line, then erase it. */
const CLEAR_LINE = "\r\u001B[K";

/** The part of a stream the progress line needs; `process.stderr` fits. */
export type ProgressOutput = {
  readonly isTTY?: boolean | undefined;
  readonly write: (text: string) => unknown;
};

const formatted = (count: number): string => count.toLocaleString("en-US");

/**
 * Provides `ParseProgress` as one line, such as `Reading TypeScript history:
 * 12,345 / 57,923 file versions`, rewritten in place at most ten times a
 * second and erased when the parse is over or the scope closes. Without a
 * terminal in `output` it provides a report that prints nothing.
 */
export const parseProgressLayer = (output: ProgressOutput) =>
  Layer.effect(
    ParseProgress,
    Effect.gen(function* () {
      if (output.isTTY !== true) {
        return { update: () => Effect.void };
      }
      let lastWrite = Number.NEGATIVE_INFINITY;
      let shown = false;
      const clear = Effect.sync(() => {
        if (shown) {
          output.write(CLEAR_LINE);
          shown = false;
        }
      });
      yield* Effect.addFinalizer(() => clear);
      return {
        update: (done: number, total: number) =>
          Effect.gen(function* () {
            const now = yield* Clock.currentTimeMillis;
            if (done >= total) {
              yield* clear;
            } else if (now - lastWrite >= MIN_INTERVAL_MS) {
              lastWrite = now;
              shown = true;
              output.write(
                `${CLEAR_LINE}Reading TypeScript history: ${formatted(done)} / ${formatted(total)} file versions`,
              );
            }
          }),
      };
    }),
  );
