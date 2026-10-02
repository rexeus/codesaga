// Owns finding the files that may import a given set of files without parsing them: a text scan for module specifiers, resolved like the import graph resolves them.
// A superset by design: every static request of a file is a quoted string without whitespace, so a file with none that resolves into the set cannot import it; a false hit only costs one parse.

import type { SourceText } from "../facts-of-source.js";
import type { Resolution } from "../imports/resolve.js";

/** A quote, then characters that hold neither quote nor whitespace nor a backslash, then the same quote. */
const SPECIFIER_SHAPED = /(["'`])([^"'`\s\\]{1,300})\1/gu;

/** The distinct quoted strings of the text that could be a module specifier. */
const specifiersIn = (text: string): ReadonlySet<string> =>
  new Set(
    Array.from(text.matchAll(SPECIFIER_SHAPED), (match) => match[2] ?? ""),
  );

/**
 * The sources among `sources` that name, by some quoted string, a file in
 * `targets`. `resolve` is the import graph's resolver; a source never names
 * itself.
 */
export const candidateImporters = (
  sources: ReadonlyArray<SourceText>,
  targets: ReadonlySet<string>,
  resolve: (from: string, specifier: string) => Resolution,
): ReadonlyArray<SourceText> =>
  sources.filter(({ path, text }) =>
    [...specifiersIn(text)].some((specifier) => {
      const found = resolve(path, specifier);
      return (
        found.kind === "file" && found.path !== path && targets.has(found.path)
      );
    }),
  );
