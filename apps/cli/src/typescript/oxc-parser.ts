import { readFile } from "node:fs/promises";
// Owns the TypeScript parser the application ships: oxc-parser, imported lazily on first use.
// oxc-parser is the one external dependency of the bundle, because its native binding cannot be bundled.
import { createRequire } from "node:module";

import {
  readyParser,
  TypeScriptParser,
  unavailableParser,
} from "@codesaga/engine";
import { Effect, Layer } from "effect";
import type * as Oxc from "oxc-parser";

const PARSER_NAME = "oxc-parser";

type OxcModule = typeof Oxc;

/** The installed version, read from the package that was actually loaded. */
const installedVersion = async (): Promise<string> => {
  const manifest: unknown = JSON.parse(
    await readFile(
      createRequire(import.meta.url).resolve("oxc-parser/package.json"),
      "utf8",
    ),
  );
  if (
    typeof manifest === "object" &&
    manifest !== null &&
    "version" in manifest &&
    typeof manifest.version === "string"
  ) {
    return manifest.version;
  }
  throw new TypeError("oxc-parser's package.json declares no version");
};

/**
 * Parses with raw transfer where the platform supports it, which skips the
 * JSON round trip and is about 2.7 times faster with identical results. A
 * platform that claims support and then fails, or a parse that fails in the
 * raw mode, continues on the default transfer.
 */
const parseWith = (oxc: OxcModule) => {
  let raw = oxc.rawTransferSupported();
  return (path: string, text: string, options: Oxc.ParserOptions) => {
    if (raw) {
      // Accepted by the parser, though its typings leave it out.
      const rawOptions = { ...options, experimentalRawTransfer: true };
      try {
        return oxc.parseSync(path, text, rawOptions);
      } catch (error) {
        if (error instanceof RangeError) {
          throw error;
        }
        raw = false;
      }
    }
    return oxc.parseSync(path, text, options);
  };
};

const firstLine = (cause: unknown): string =>
  (cause instanceof Error ? cause.message : String(cause)).split("\n")[0] ?? "";

/** Loads oxc-parser; a failure of any kind while loading or preparing it becomes an unavailable parser, never an error. */
const loadParser = Effect.tryPromise(async () =>
  readyParser(
    { name: PARSER_NAME, version: await installedVersion() },
    parseWith(await import("oxc-parser")),
  ),
).pipe(
  Effect.match({
    onSuccess: (parser) => parser,
    onFailure: ({ cause }) => unavailableParser(PARSER_NAME, firstLine(cause)),
  }),
);

/**
 * The oxc-backed `TypeScriptParser`, parsing inline on the calling thread.
 * It loads oxc-parser the first time a command asks for facts, so `inspect`
 * and `--help` never pay for it, and it provides `unavailableParser` where the
 * package or its platform binding is missing.
 */
export const oxcParserLayer = Layer.effect(
  TypeScriptParser,
  Effect.gen(function* () {
    const loaded = yield* Effect.cached(loadParser);
    return TypeScriptParser.of({
      status: Effect.flatMap(loaded, (parser) => parser.status),
      factsOf: (sources) =>
        Effect.flatMap(loaded, (parser) => parser.factsOf(sources)),
    });
  }),
);
