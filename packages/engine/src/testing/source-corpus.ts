// Tests only: the engine's own TypeScript sources as a corpus of real files, for suites that compare two ways of reading the same code.
import { Effect, FileSystem, Path } from "effect";

import type { SourceText } from "../typescript/facts-of-source.js";

/** Every non-declaration `.ts` file below the engine's `src`, with its path relative to it. */
export const engineSources: Effect.Effect<
  ReadonlyArray<SourceText>,
  never,
  FileSystem.FileSystem | Path.Path
> = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = path.join(import.meta.dirname, "..");
  const names = yield* fs.readDirectory(root, { recursive: true });
  return yield* Effect.forEach(
    names
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".d.ts"))
      .toSorted(),
    (name) =>
      fs
        .readFileString(path.join(root, name))
        .pipe(Effect.map((text): SourceText => ({ path: name, text }))),
  );
}).pipe(Effect.orDie);
