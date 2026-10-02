// Owns reading blobs by id: the ids go to one `git cat-file --batch` process
// and each blob comes back decoded as UTF-8, or as the reason it was skipped.
import { Effect, Stream } from "effect";

import { FrameParser } from "./blob-frames.js";
import type { GitError } from "./git-errors.js";
import { Git } from "./git.js";

/** A blob to read: its full id and, when known, the mode its path had. */
export type BlobRef = {
  readonly oid: string;
  /** As git prints it; `120000` (symlink) and `160000` (submodule) are never read. */
  readonly mode?: string;
};

/** Why a blob has no text. */
type SkipReason =
  /** Not valid UTF-8. */
  | "binary"
  /** The mode says the entry is a symlink. */
  | "symlink"
  /** The mode says the entry is a submodule. */
  | "submodule"
  /** git has no such blob, as in a partial clone, or the id is not a full hex id. */
  | "unreadable";

export type BlobRead =
  | { readonly oid: string; readonly text: string }
  | { readonly oid: string; readonly skipped: SkipReason };

const SKIPPED_BY_MODE = new Map<string, SkipReason>([
  ["120000", "symlink"],
  ["160000", "submodule"],
]);
const FULL_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;

const refusal = ({ oid, mode }: BlobRef): SkipReason | undefined => {
  if (!FULL_ID.test(oid)) {
    return "unreadable";
  }
  return mode === undefined ? undefined : SKIPPED_BY_MODE.get(mode);
};

const skipped = (oid: string, reason: SkipReason): BlobRead => ({
  oid,
  skipped: reason,
});

const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

const decode = (oid: string, content: Uint8Array): BlobRead => {
  try {
    return { oid, text: decoder.decode(content) };
  } catch {
    return skipped(oid, "binary");
  }
};

/**
 * Reads the blobs through one `cat-file --batch` process and emits one result
 * per requested blob, in no promised order: first those skipped by mode or by
 * an id that is not a full hex id, then the rest as git answers. A blob that is
 * not valid UTF-8 is skipped as `binary`; a byte-order mark stays in the text.
 *
 * Git must run in the repository that holds the blobs.
 */
export const readBlobs = (
  blobs: ReadonlyArray<BlobRef>,
): Stream.Stream<BlobRead, GitError, Git> =>
  Stream.unwrap(
    Effect.gen(function* () {
      const git = yield* Git;
      const refused = blobs.flatMap((blob): Array<BlobRead> => {
        const reason = refusal(blob);
        return reason === undefined ? [] : [skipped(blob.oid, reason)];
      });
      const requested = blobs
        .filter((blob) => refusal(blob) === undefined)
        .map(({ oid }) => oid);
      if (requested.length === 0) {
        return Stream.fromIterable(refused);
      }
      return Stream.concat(
        Stream.fromIterable(refused),
        git.bytes(["cat-file", "--batch"], `${requested.join("\n")}\n`).pipe(
          Stream.mapAccum(
            () => new FrameParser(),
            (parser, chunk) => [parser, parser.push(chunk)],
            { onHalt: (parser) => parser.end() },
          ),
          Stream.map((frame) =>
            "content" in frame
              ? decode(frame.oid, frame.content)
              : skipped(frame.oid, "unreadable"),
          ),
        ),
      );
    }),
  );
