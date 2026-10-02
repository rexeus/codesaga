import { TypeScriptParser } from "@codesaga/engine";
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";

import { oxcParserLayer } from "./oxc-parser.js";

const factsOf = (...texts: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const parser = yield* TypeScriptParser;
    return yield* parser.factsOf(
      texts.map((text, index) => ({ path: `f${index}.ts`, text })),
    );
  }).pipe(Effect.provide(oxcParserLayer));

describe("oxcParserLayer", () => {
  it.effect("parses with the installed oxc-parser and says which version", () =>
    Effect.gen(function* () {
      const status = yield* TypeScriptParser.use(
        (parser) => parser.status,
      ).pipe(Effect.provide(oxcParserLayer));

      assert.strictEqual(status.kind, "ready");
      assert.strictEqual(status.name, "oxc-parser");
      assert.match(
        status.kind === "ready" ? status.version : "",
        /^\d+\.\d+\.\d+$/u,
      );
    }),
  );

  it.effect("turns sources into facts, one verdict per source in order", () =>
    Effect.gen(function* () {
      const results = yield* factsOf("const a = 1;\n", "const a = ;\n", "");

      // Program, VariableDeclaration, VariableDeclarator, Identifier, Literal
      assert.deepStrictEqual(results, [
        { kind: "parsed", facts: { version: 1, nodes: 5 } },
        { kind: "skipped", reason: "syntax-error" },
        { kind: "parsed", facts: { version: 1, nodes: 1 } },
      ]);
    }),
  );
});
