// Tests only: the platform services with a parser that did not load, for suites about what the parser does not touch.
import { NodeServices } from "@effect/platform-node";
import { Layer } from "effect";

import {
  TypeScriptParser,
  unavailableParser,
} from "../typescript/typescript-parser.js";

/** The platform services and a parser that is unavailable, so a result carries no TypeScript figures. */
export const servicesWithoutParser = Layer.mergeAll(
  NodeServices.layer,
  Layer.succeed(
    TypeScriptParser,
    unavailableParser("oxc-parser", "not loaded in this test"),
  ),
);
