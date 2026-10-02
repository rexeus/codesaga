// Owns reading a candidate file and deciding whether it is analyzable text.
import { Effect, FileSystem, Path } from "effect";
import type { ByteSize } from "effect";

import { commentSyntaxOf } from "../stats/comments.js";
import { measureText } from "../stats/measure-text.js";
import type { TextMeasure } from "../stats/measure-text.js";
import { languageOf } from "./languages.js";

/** Larger files count as binary. */
const MAX_FILE_BYTES = 1_048_576;
/** Text with longer lines on average counts as minified. */
const MAX_MEAN_LINE_LENGTH = 300;
const BINARY_SNIFF_BYTES = 8192;

const isBinary = (bytes: Uint8Array): boolean =>
  bytes.subarray(0, BINARY_SNIFF_BYTES).includes(0);

const exceedsLimit = (size: ByteSize.ByteSize): boolean =>
  size > BigInt(MAX_FILE_BYTES);

/**
 * What reading `<root>/<file>` revealed (its non-blank lines, indentation,
 * line lengths and comments), or undefined when the file cannot be analyzed:
 * unreadable (missing) or not a regular file (a directory, a device), binary,
 * or minified.
 */
export const measureSourceFile = (
  root: string,
  file: string,
): Effect.Effect<
  TextMeasure | undefined,
  never,
  FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const location = path.join(root, file);
    const info = yield* fs.stat(location);
    if (info.type !== "File" || exceedsLimit(info.size)) {
      return undefined;
    }
    const bytes = yield* fs.readFile(location);
    if (isBinary(bytes)) {
      return undefined;
    }
    const text = new TextDecoder().decode(bytes);
    const measure = measureText(text, commentSyntaxOf(languageOf(file)));
    return text.length > MAX_MEAN_LINE_LENGTH * measure.loc
      ? undefined
      : measure;
  }).pipe(Effect.orElseSucceed(() => undefined));
