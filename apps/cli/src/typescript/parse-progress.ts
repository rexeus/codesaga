// Owns the progress line on a terminal while the history's TypeScript is parsed for the first time.
// It is written to stderr, never stdout, and only when stderr is a terminal.
import { ParseProgress } from "@codesaga/engine";
import { Clock, Effect, Layer } from "effect";

/** At most ten updates a second. */
const MIN_INTERVAL_MS = 100;
/** Back to the start of the line, then erase it. */
const CLEAR_LINE = "\r\u001B[K";
/** An estimate from less work than this would swing too wildly to show. */
const MIN_ESTIMATE_ELAPSED_MS = 3_000;
const ESTIMATE_STEP_SECONDS = 5;
const SECONDS_PER_MINUTE = 60;

/** The part of a stream the progress line needs; `process.stderr` fits. */
export type ProgressOutput = {
  readonly isTTY?: boolean | undefined;
  readonly write: (text: string) => unknown;
};

const formatted = (count: number): string => count.toLocaleString("en-US");

/**
 * The time left at the pace so far, rounded up to five seconds, or nothing
 * while too little work is done to say: `45s`, `2m 15s`.
 */
const remainingText = (
  elapsedMs: number,
  done: number,
  total: number,
): string | undefined => {
  if (done <= 0 || elapsedMs < MIN_ESTIMATE_ELAPSED_MS) {
    return undefined;
  }
  const seconds =
    Math.ceil(
      (elapsedMs * (total - done)) / done / 1_000 / ESTIMATE_STEP_SECONDS,
    ) * ESTIMATE_STEP_SECONDS;
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  return minutes === 0
    ? `${seconds}s`
    : `${minutes}m ${seconds % SECONDS_PER_MINUTE}s`;
};

/**
 * Provides `ParseProgress` as one line, such as `Reading TypeScript history:
 * 12,345 / 57,923 file versions, about 1m 20s left`, rewritten in place at
 * most ten times a second and erased when the parse is over or the scope
 * closes. The estimate is the pace since the first update, which the engine
 * sends with nothing done yet, and appears after a few seconds. Without a
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
      let startedAt: number | undefined;
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
            startedAt ??= now;
            if (done >= total) {
              yield* clear;
            } else if (now - lastWrite >= MIN_INTERVAL_MS) {
              lastWrite = now;
              shown = true;
              const left = remainingText(now - startedAt, done, total);
              output.write(
                `${CLEAR_LINE}Reading TypeScript history: ${formatted(done)} / ${formatted(total)} file versions${left === undefined ? "" : `, about ${left} left`}`,
              );
            }
          }),
      };
    }),
  );
