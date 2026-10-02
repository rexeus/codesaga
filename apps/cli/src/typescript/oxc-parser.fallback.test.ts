import { TypeScriptParser } from "@codesaga/engine";
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import type * as Oxc from "oxc-parser";
import { vi } from "vitest";

import { oxcParserLayer } from "./oxc-parser.js";

const transfers = vi.hoisted(() => ({ raw: 0, plain: 0 }));

vi.mock("oxc-parser", async (importOriginal) => {
  const original = await importOriginal<typeof Oxc>();
  return {
    ...original,
    rawTransferSupported: () => true,
    parseSync: (
      path: string,
      text: string,
      options: Record<string, unknown>,
    ) => {
      if (options["experimentalRawTransfer"] === true) {
        transfers.raw += 1;
        throw new Error("raw transfer failed on this platform");
      }
      transfers.plain += 1;
      return original.parseSync(path, text, options);
    },
  };
});

describe("oxcParserLayer when raw transfer fails", () => {
  it.effect(
    "parses on the default transfer and stops trying raw transfer",
    () =>
      Effect.gen(function* () {
        const parser = yield* TypeScriptParser;

        const results = yield* parser.factsOf([
          { path: "a.ts", text: "const a = 1;\n" },
          { path: "b.ts", text: "const b = 2;\n" },
        ]);

        assert.deepStrictEqual(
          results.map(({ kind }) => kind),
          ["parsed", "parsed"],
        );
        assert.deepStrictEqual(transfers, { raw: 1, plain: 2 });
      }).pipe(Effect.provide(oxcParserLayer)),
  );
});
