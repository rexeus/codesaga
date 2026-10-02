// Tests only: the real oxc parser as the TypeScript parser service, on the default (JSON) transfer.
import { NodeServices } from "@effect/platform-node";
import { Layer } from "effect";
import { parseSync } from "oxc-parser";

import type { ParseSource } from "../typescript/facts-of-source.js";
import {
  readyParser,
  TypeScriptParser,
} from "../typescript/typescript-parser.js";

/** Reads a source the way the application's layer does, minus raw transfer. */
export const oxcParse: ParseSource = (path, text, options) =>
  parseSync(path, text, options);

/** The parser service over oxc-parser. */
const oxcParserLayer = Layer.succeed(
  TypeScriptParser,
  readyParser({ name: "oxc-parser", version: "test" }, oxcParse),
);

/** The platform services and the parser: what `analyze` needs besides the repository. */
export const analyzeServices = Layer.mergeAll(
  NodeServices.layer,
  oxcParserLayer,
);
