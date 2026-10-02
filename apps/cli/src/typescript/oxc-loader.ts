// Owns loading oxc-parser and parsing with it: the one place that touches the native binding.
// It runs inside a parse child, so a binding that kills its process never takes the application with it.
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

import type * as Oxc from "oxc-parser";

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
 * raw mode, continues on the default transfer; a `RangeError` is the file's
 * own and passes through.
 */
const parseWith = (oxc: typeof Oxc) => {
  let raw = oxc.rawTransferSupported();
  return (
    path: string,
    text: string,
    options: Oxc.ParserOptions,
  ): Oxc.ParseResult => {
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

/**
 * Imports oxc-parser and says which version loaded, with a `parse` for the
 * engine's `factsOfSource`. Rejects when the package, its platform binding
 * or the raw transfer probe fails.
 */
export const loadOxcParser = async () => {
  const oxc = await import("oxc-parser");
  return { version: await installedVersion(), parse: parseWith(oxc) };
};
