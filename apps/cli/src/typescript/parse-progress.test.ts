import { ParseProgress } from "@codesaga/engine";
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { parseProgressLayer } from "./parse-progress.js";

const recording = (isTTY: boolean) => {
  const writes: Array<string> = [];
  return {
    writes,
    layer: parseProgressLayer({
      isTTY,
      write: (text) => writes.push(text),
    }),
  };
};

describe("parseProgressLayer", () => {
  it.effect(
    "rewrites one line at most ten times a second and erases it at the end",
    () => {
      const { writes, layer } = recording(true);
      return Effect.gen(function* () {
        const progress = yield* ParseProgress;
        yield* progress.update(500, 57_923);
        yield* TestClock.adjust(40);
        yield* progress.update(1_000, 57_923);
        yield* TestClock.adjust(60);
        yield* progress.update(12_345, 57_923);
        yield* progress.update(57_923, 57_923);

        assert.deepStrictEqual(writes, [
          "\r\u001B[KReading TypeScript history: 500 / 57,923 file versions",
          "\r\u001B[KReading TypeScript history: 12,345 / 57,923 file versions",
          "\r\u001B[K",
        ]);
      }).pipe(Effect.provide(layer));
    },
  );

  it.effect(
    "erases the line when the scope closes before the parse ends",
    () => {
      const { writes, layer } = recording(true);
      return Effect.gen(function* () {
        yield* Effect.scoped(
          Effect.gen(function* () {
            const progress = yield* ParseProgress;
            yield* progress.update(10, 100);
          }).pipe(Effect.provide(layer)),
        );

        assert.strictEqual(writes.at(-1), "\r\u001B[K");
        assert.strictEqual(writes.length, 2);
      });
    },
  );

  it.effect("prints nothing when the output is not a terminal", () => {
    const { writes, layer } = recording(false);
    return Effect.gen(function* () {
      const progress = yield* ParseProgress;
      yield* progress.update(10, 100);
      yield* progress.update(100, 100);

      assert.deepStrictEqual(writes, []);
    }).pipe(Effect.provide(layer));
  });
});

describe("parseProgressLayer time left", () => {
  it.effect(
    "adds the time left at the pace since the first update once a few seconds of work are behind it",
    () => {
      const { writes, layer } = recording(true);
      return Effect.gen(function* () {
        const progress = yield* ParseProgress;
        yield* progress.update(0, 100);
        yield* TestClock.adjust(2_000);
        yield* progress.update(10, 100);
        yield* TestClock.adjust(8_000);
        yield* progress.update(25, 100);
        yield* TestClock.adjust(10_000);
        yield* progress.update(30, 100);

        assert.deepStrictEqual(writes, [
          "\r\u001B[KReading TypeScript history: 0 / 100 file versions",
          "\r\u001B[KReading TypeScript history: 10 / 100 file versions",
          "\r\u001B[KReading TypeScript history: 25 / 100 file versions, about 30s left",
          "\r\u001B[KReading TypeScript history: 30 / 100 file versions, about 50s left",
        ]);
      }).pipe(Effect.provide(layer));
    },
  );

  it.effect("shows minutes once more than a minute is left", () => {
    const { writes, layer } = recording(true);
    return Effect.gen(function* () {
      const progress = yield* ParseProgress;
      yield* progress.update(0, 100);
      yield* TestClock.adjust(10_000);
      yield* progress.update(10, 100);

      assert.strictEqual(
        writes.at(-1),
        "\r\u001B[KReading TypeScript history: 10 / 100 file versions, about 1m 30s left",
      );
    }).pipe(Effect.provide(layer));
  });
});
