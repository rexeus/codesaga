import { TypeScriptParser } from "@codesaga/engine";
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { vi } from "vitest";

import { oxcParserLayer } from "./oxc-parser.js";

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

describe("oxcParserLayer when oxc-parser cannot start", () => {
  it.effect(
    "reports the load failure's first line and skips every source instead of failing",
    () =>
      Effect.gen(function* () {
        const parser = yield* TypeScriptParser;

        const status = yield* parser.status;
        const results = yield* parser.factsOf([
          { path: "a.ts", text: "const a = 1;\n" },
          { path: "b.ts", text: "const b = 2;\n" },
        ]);

        assert.deepStrictEqual(status, {
          kind: "unavailable",
          name: "oxc-parser",
          reason: "Cannot find native binding.",
        });
        assert.deepStrictEqual(results, [
          { kind: "skipped", reason: "parser-unavailable" },
          { kind: "skipped", reason: "parser-unavailable" },
        ]);
      }).pipe(Effect.provide(oxcParserLayer)),
  );
});
