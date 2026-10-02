import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { vi } from "vitest";

import { loadOxcParser } from "./oxc-loader.js";

// The generated loader throws like this from the first call into the binding when no platform package matches.
vi.mock("oxc-parser", () => ({
  rawTransferSupported: () => {
    throw new Error(
      "Cannot find native binding.\nCause: nothing matched this platform",
    );
  },
  parseSync: () => {
    throw new Error("unreachable");
  },
}));

describe("loadOxcParser when oxc-parser cannot start", () => {
  it.effect("rejects with the loader's own message", () =>
    Effect.gen(function* () {
      const error = yield* Effect.promise(() =>
        loadOxcParser().then(
          () => undefined,
          (cause: unknown) => cause,
        ),
      );

      assert.instanceOf(error, Error);
      assert.match(
        error instanceof Error ? error.message : "",
        /^Cannot find native binding\./u,
      );
    }),
  );
});
