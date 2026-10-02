import { TypeScriptParser } from "@codesaga/engine";
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";

import { sourceProgram } from "../testing/child-program.js";
import { makeOxcParserLayer } from "./oxc-parser.js";

const PARSED = {
  kind: "parsed",
  facts: { version: 1, nodes: 5 },
} as const;

// No brackets for a text scan to see, and enough levels to kill the native parser.
const CRASH_PAYLOAD = `x = ${"a ?\nb :\n".repeat(20_000)}c;\n`;

/** A real child process each, started from the sources, as `pnpm dev` starts them. */
const withParser = <A, E>(
  use: (parser: TypeScriptParser["Service"]) => Effect.Effect<A, E>,
) =>
  Effect.gen(function* () {
    const parser = yield* TypeScriptParser;
    return yield* use(parser);
  }).pipe(Effect.provide(makeOxcParserLayer(sourceProgram())));

describe("makeOxcParserLayer", () => {
  it.live("parses in a child process and says which version loaded", () =>
    withParser((parser) =>
      Effect.gen(function* () {
        const status = yield* parser.status;
        const results = yield* parser.factsOf([
          { path: "a.ts", text: "const a = 1;\n" },
          { path: "b.ts", text: "const b = ;\n" },
        ]);

        assert.strictEqual(status.kind, "ready");
        assert.strictEqual(status.name, "oxc-parser");
        assert.match(
          status.kind === "ready" ? status.version : "",
          /^\d+\.\d+\.\d+$/u,
        );
        assert.deepStrictEqual(results, [
          PARSED,
          { kind: "skipped", reason: "syntax-error" },
        ]);
      }),
    ),
  );

  it.live(
    // Whether this payload crashes the native parser or overflows the walker
    // depends on the machine's stack size; either way only that file is lost.
    "skips the file too deep to parse and still parses the rest",
    () =>
      withParser((parser) =>
        Effect.gen(function* () {
          const results = yield* parser.factsOf([
            { path: "a.ts", text: "const a = 1;\n" },
            { path: "hostile.ts", text: CRASH_PAYLOAD },
            { path: "c.ts", text: "const c = 1;\n" },
            { path: "d.ts", text: "const d = 1;\n" },
          ]);

          assert.deepStrictEqual(
            [results[0], results[2], results[3]],
            [PARSED, PARSED, PARSED],
          );
          const hostile = results[1];
          assert.ok(
            hostile?.kind === "skipped" &&
              (hostile.reason === "parser-crashed" ||
                hostile.reason === "too-deep"),
          );
        }),
      ),
    60_000,
  );
});
