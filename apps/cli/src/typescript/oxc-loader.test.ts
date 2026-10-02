import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";

import { loadOxcParser } from "./oxc-loader.js";

describe("loadOxcParser", () => {
  it.effect("loads the installed oxc-parser and says which version", () =>
    Effect.gen(function* () {
      const { version, parse } = yield* Effect.promise(loadOxcParser);

      assert.match(version, /^\d+\.\d+\.\d+$/u);
      const parsed = parse("a.ts", "const a = 1;\n", {
        lang: "ts",
        sourceType: "module",
      });
      assert.strictEqual(parsed.program.body.length, 1);
    }),
  );
});
