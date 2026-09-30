// Owns the per-person and per-file facts the expertise model reads from the classified history.
// Only human and agent-assisted commits create people; bot and agent commits never do.
// One pass over the commits, limited to the paths that matter.

import { isContributorCommit } from "../automation/classify.js";
import type { ClassifiedCommit } from "../automation/classify.js";

/** A person who can be an expert, over the whole history of the scope. */
export type Human = {
  /** Mailmap-normalized, lowercased; the identity. */
  readonly email: string;
  readonly name: string;
  /** Human and agent-assisted commits. */
  readonly commits: number;
  /** Time of the last such commit, in seconds since the epoch. */
  readonly lastTime: number;
};

/** What one person did to one file. */
export type Contribution = {
  readonly email: string;
  readonly adds: number;
  readonly firstAuthor: boolean;
  /** Time of the last commit to the file, in seconds since the epoch. */
  readonly lastTime: number;
};

/** The people behind the human and agent-assisted commits, keyed by email. */
export const humansOf = (
  commits: ReadonlyArray<ClassifiedCommit>,
): ReadonlyMap<string, Human> => {
  const humans = new Map<string, Human>();
  for (const commit of commits) {
    if (!isContributorCommit(commit)) {
      continue;
    }
    const { email, name } = commit.author;
    const before = humans.get(email);
    humans.set(email, {
      email,
      name,
      commits: (before?.commits ?? 0) + 1,
      lastTime: Math.max(before?.lastTime ?? 0, commit.time),
    });
  }
  return humans;
};

type Tally = { readonly adds: number; readonly lastTime: number };
type Tallies = Map<string, Map<string, Tally>>;

const tally = (
  tallies: Tallies,
  path: string,
  commit: ClassifiedCommit,
  added: number,
): void => {
  const byPerson = tallies.get(path) ?? new Map<string, Tally>();
  const before = byPerson.get(commit.author.email);
  byPerson.set(commit.author.email, {
    adds: (before?.adds ?? 0) + added,
    lastTime: Math.max(before?.lastTime ?? 0, commit.time),
  });
  tallies.set(path, byPerson);
};

/**
 * What each human did to each of `paths`, in the file's current life only: a
 * path deleted and created again gives the old file's work no credit.
 * `commits` run newest first, so the last commit seen for a path is its
 * oldest: its author is the first author unless a bot or an agent wrote it,
 * in which case nobody is.
 */
export const contributionsByFile = (
  commits: ReadonlyArray<ClassifiedCommit>,
  paths: ReadonlySet<string>,
): ReadonlyMap<string, ReadonlyArray<Contribution>> => {
  const tallies: Tallies = new Map();
  const oldest = new Map<string, ClassifiedCommit>();
  for (const commit of commits) {
    const contributor = isContributorCommit(commit);
    for (const { path, added, previousLife } of commit.changes) {
      if (previousLife === true || !paths.has(path)) {
        continue;
      }
      oldest.set(path, commit);
      if (contributor) {
        tally(tallies, path, commit, added);
      }
    }
  }
  return new Map(
    [...tallies].map(([path, byPerson]) => {
      const first = oldest.get(path);
      const firstEmail =
        first !== undefined && isContributorCommit(first)
          ? first.author.email
          : undefined;
      return [
        path,
        [...byPerson].map(([email, { adds, lastTime }]) => ({
          email,
          adds,
          lastTime,
          firstAuthor: email === firstEmail,
        })),
      ];
    }),
  );
};
