// Tests only: commits whose changes carry blob ids, with the digest of each blob, for the craft badges that compare a file before and after.
import type { ClassifiedCommit } from "../automation/classify.js";
import { contributorBadges } from "../badges/contributor-badges.js";
import type { FileChange } from "../history/history.js";
import type { FileDigest } from "../typescript/digest/file-digest.js";
import { ada, badgeFacts, commit, daysAgo } from "./contributor-badge-facts.js";
import { digestWith } from "./file-digest.js";

const blobs = new Map<string, FileDigest>();
let counter = 0;

/** The digest of a blob a test made with `blob`. */
export const factsLookup = (oid: string): FileDigest | undefined =>
  blobs.get(oid);

/** A blob with a digest that counts nothing but `digest`, named by a fresh id. */
export const blob = (digest: Parameters<typeof digestWith>[0]): string => {
  counter += 1;
  const oid = `blob${counter}`;
  blobs.set(oid, digestWith(digest));
  return oid;
};

/** A change of `path` from `previousOid` (absent for an addition) to `oid` (absent for a deletion). */
export const change = (
  path: string,
  oid: string | undefined,
  previousOid?: string,
): FileChange => ({
  path,
  added: 1,
  deleted: 1,
  ...(oid === undefined ? {} : { oid }),
  ...(previousOid === undefined ? {} : { previousOid }),
});

/** A human commit of Ada `day` days before the badge clock with `changes`. */
export const commitOf = (
  day: number,
  changes: ReadonlyArray<FileChange>,
  overrides: Partial<ClassifiedCommit> = {},
): ClassifiedCommit => commit(daysAgo(day), [], 0, { changes, ...overrides });

/** The kinds of the badges Ada earns with `commits` when the history's facts are read. */
export const kinds = (
  commits: ReadonlyArray<ClassifiedCommit>,
): ReadonlyArray<string> =>
  contributorBadges(ada, badgeFacts(commits, { factsLookup })).map(
    ({ kind }) => kind,
  );
