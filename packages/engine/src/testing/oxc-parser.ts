// Tests only: the real oxc parser as the TypeScript parser service, on the default (JSON) transfer.
import { NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { parseSync } from "oxc-parser";

import { factsOfSource } from "../typescript/facts-of-source.js";
import type { ParseSource } from "../typescript/facts-of-source.js";
import { TypeScriptParser } from "../typescript/typescript-parser.js";

/** Reads a source the way the application's layer does, minus raw transfer. */
export const oxcParse: ParseSource = (path, text, options) =>
  parseSync(path, text, options);

/** The parser service over oxc-parser. */
const oxcParserLayer = Layer.succeed(
  TypeScriptParser,
  TypeScriptParser.of({
    status: Effect.succeed({
      kind: "ready",
      name: "oxc-parser",
      version: "test",
    }),
    factsOf: (sources) =>
      Effect.sync(() =>
        sources.map((source) => factsOfSource(oxcParse, source)),
      ),
  }),
);

/** The platform services and the parser: what `analyze` needs besides the repository. */
export const analyzeServices = Layer.mergeAll(
  NodeServices.layer,
  oxcParserLayer,
);
