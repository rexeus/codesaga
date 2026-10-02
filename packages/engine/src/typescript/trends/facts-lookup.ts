// Owns asking the history's facts what a file version held: by blob and path, or for what one change did to a file.
import type { FileChange } from "../../history/history.js";
import type { FileDigest } from "../digest/file-digest.js";
import { factsKey } from "../history-blobs.js";
import type { HistoryFacts } from "../history-facts.js";

/** The digest of the blob read as the file at `path`, or undefined when it was not parsed: skipped, outside the universe, or not a script. */
export type FactsLookup = (oid: string, path: string) => FileDigest | undefined;

export const factsLookupOf =
  ({ factsByBlob }: HistoryFacts): FactsLookup =>
  (oid, path) => {
    const verdict = factsByBlob.get(factsKey(oid, path));
    return verdict?.kind === "parsed" ? verdict.facts : undefined;
  };

/** The facts of a file before and after a change; null where the commit has no such file (an addition has no before, a deletion no after). */
export type ChangeFacts = {
  readonly before: FileDigest | null;
  readonly after: FileDigest | null;
};

/**
 * The facts a change turned into others, or undefined when either version
 * has none to read (a syntax error, a skipped file): a change between a
 * known and an unknown state says nothing of what it did.
 */
export const changeFactsOf = (
  { path, oid, previousOid }: FileChange,
  lookup: FactsLookup,
): ChangeFacts | undefined => {
  const before = previousOid === undefined ? null : lookup(previousOid, path);
  const after = oid === undefined ? null : lookup(oid, path);
  return before === undefined || after === undefined
    ? undefined
    : { before, after };
};
