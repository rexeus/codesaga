// Owns reading a candidate file and deciding whether it is analyzable text.
import { Effect, FileSystem, Path } from "effect";
import type { ByteSize } from "effect";

/** Larger files count as binary. */
const MAX_FILE_BYTES = 1_048_576;
/** Text with longer lines on average counts as minified. */
const MAX_MEAN_LINE_LENGTH = 300;
const BINARY_SNIFF_BYTES = 8192;

const isBinary = (bytes: Uint8Array): boolean =>
  bytes.subarray(0, BINARY_SNIFF_BYTES).includes(0);

const exceedsLimit = (size: ByteSize.ByteSize): boolean =>
  size > BigInt(MAX_FILE_BYTES);

const countCodeLines = (text: string): number =>
  text.split("\n").filter((line) => line.trim() !== "").length;

/**
 * The non-blank lines of `<root>/<file>`, or undefined when the file cannot be
 * analyzed: unreadable (missing) or not a regular file (a directory, a device), binary, or minified.
 */
export const measureSourceFile = (
  root: string,
  file: string,
): Effect.Effect<
  number | undefined,
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
    const loc = countCodeLines(text);
    return text.length > MAX_MEAN_LINE_LENGTH * loc ? undefined : loc;
  }).pipe(Effect.orElseSucceed(() => undefined));
