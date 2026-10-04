// Owns which blobs of the history the deep dive reads: every TypeScript and JavaScript version a change names, before and after.
import type { BlobRef } from "../git/blob-reader.js";
import type { BlobFields } from "../history/raw-entry.js";
import {
  isDeclarationPath,
  isScriptPath,
  parseOptionsOf,
} from "./source-kinds.js";

/** A change to one file: its path and the blobs and modes it names. */
export type BlobChange = BlobFields & { readonly path: string };

/** A blob to parse, with the path that tells how to parse it. */
export type HistoryBlob = BlobRef & { readonly path: string };

/** The parse options of a path as a key suffix, remembered per path: a replay keys every change of the history. */
const suffixes = new Map<string, string>();
const optionsSuffixOf = (path: string): string => {
  const known = suffixes.get(path);
  if (known !== undefined) {
    return known;
  }
  const { lang, sourceType } = parseOptionsOf(path);
  const suffix = `${lang}:${sourceType}`;
  suffixes.set(path, suffix);
  return suffix;
};

/**
 * What a verdict is keyed by: the blob and the options its path makes the
 * parser read it with. The same blob under `a.ts` and `b.tsx` parses
 * differently, so it has two verdicts.
 */
export const factsKey = (oid: string, path: string): string =>
  `${oid}:${optionsSuffixOf(path)}`;

const isParsable = (path: string): boolean =>
  isScriptPath(path) && !isDeclarationPath(path);

/** The versions of a file a change names: the one it leaves and the one it replaces. */
const blobsOfChange = (change: BlobChange): Array<HistoryBlob> => {
  const { path, oid, mode, previousOid, previousMode } = change;
  const after =
    oid === undefined
      ? []
      : [{ path, oid, ...(mode === undefined ? {} : { mode }) }];
  const before =
    previousOid === undefined
      ? []
      : [
          {
            path,
            oid: previousOid,
            ...(previousMode === undefined ? {} : { mode: previousMode }),
          },
        ];
  return [...after, ...before];
};

/**
 * The distinct blobs of the changes' TypeScript and JavaScript files, before
 * and after each change, each with every path it was met under; declaration
 * files are left out.
 */
export const blobsOfChanges = (
  changes: ReadonlyArray<BlobChange>,
): ReadonlyArray<HistoryBlob> => {
  const blobs = new Map<string, HistoryBlob>();
  const changed = changes
    .filter(({ path }) => isParsable(path))
    .flatMap((change) => blobsOfChange(change));
  for (const blob of changed) {
    const key = `${blob.oid}:${blob.path}`;
    if (!blobs.has(key)) {
      blobs.set(key, blob);
    }
  }
  return [...blobs.values()];
};
