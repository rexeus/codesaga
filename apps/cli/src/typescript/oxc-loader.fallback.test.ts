import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import type * as Oxc from "oxc-parser";
import { vi } from "vitest";

import { loadOxcParser } from "./oxc-loader.js";

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

describe("loadOxcParser when raw transfer fails", () => {
  it.effect(
    "parses on the default transfer and stops trying raw transfer",
    () =>
      Effect.gen(function* () {
        const { parse } = yield* Effect.promise(loadOxcParser);
        const options = { lang: "ts", sourceType: "module" } as const;

        parse("a.ts", "const a = 1;\n", options);
        parse("b.ts", "const b = 2;\n", options);

        assert.deepStrictEqual(transfers, { raw: 1, plain: 2 });
      }),
  );
});
