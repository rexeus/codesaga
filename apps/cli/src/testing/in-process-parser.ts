// Tests only: the real oxc parser as the TypeScript parser service, in the test's own process.
// Journeys use it so that they do not start a child process per run; the pool has its own tests.
import { factsOfSource, TypeScriptParser } from "@codesaga/engine";
import { Effect, Layer } from "effect";

import { loadOxcParser } from "../typescript/oxc-loader.js";

export const inProcessParserLayer = Layer.effect(
  TypeScriptParser,
  Effect.promise(async () => {
    const { version, parse } = await loadOxcParser();
    return TypeScriptParser.of({
      status: Effect.succeed({ kind: "ready", name: "oxc-parser", version }),
      factsOf: (sources) =>
        Effect.sync(() =>
          sources.map((source) => factsOfSource(parse, source)),
        ),
    });
  }),
);
