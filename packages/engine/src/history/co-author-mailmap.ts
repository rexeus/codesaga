// Owns resolving `Co-authored-by` trailers through the repository's mailmap.
// `git log --use-mailmap` rewrites author and committer lines only, so the
// trailers are resolved here, after the log (or the cache) is read: the cache
// holds them as written, and its fingerprint already keys on the mailmap.
import { Effect } from "effect";

import { Git } from "../git/git.js";
import type { Commit } from "./parse-log.js";

const PERSON = /^([^<>]*?)\s*<([^<>\s]+@[^<>\s]+)>$/u;

const isCoAuthor = ({ key }: Commit["trailers"][number]): boolean =>
  key.toLowerCase() === "co-authored-by";

/** The `Name <email>` a lookup sends for a trailer value, or undefined for a value that names no address. */
const lookupOf = (value: string): string | undefined => {
  const [, name = "", email = ""] = PERSON.exec(value) ?? [];
  return email === "" ? undefined : `${name} <${email}>`.trim();
};

/** The distinct lookups of every co-author trailer in `commits`, in first-seen order. */
const lookupsOf = (commits: ReadonlyArray<Commit>): ReadonlyArray<string> => [
  ...new Set(
    commits.flatMap(({ trailers }) =>
      trailers.flatMap(
        (trailer) =>
          (isCoAuthor(trailer) ? lookupOf(trailer.value) : undefined) ?? [],
      ),
    ),
  ),
];

/** What each lookup resolves to; empty when git cannot answer, which leaves the trailers as written. */
const resolve = (
  lookups: ReadonlyArray<string>,
): Effect.Effect<ReadonlyMap<string, string>, never, Git> =>
  Effect.gen(function* () {
    const git = yield* Git;
    const output = yield* git.text(
      ["check-mailmap", "--stdin"],
      `${lookups.join("\n")}\n`,
    );
    const resolved = output.split("\n").slice(0, -1);
    return resolved.length === lookups.length
      ? new Map(
          lookups.map((lookup, index) => [lookup, resolved[index] ?? lookup]),
        )
      : new Map<string, string>();
  }).pipe(Effect.orElseSucceed(() => new Map<string, string>()));

/**
 * The commits with every `Co-authored-by: Name <email>` trailer rewritten to
 * the name and address `.mailmap` (`mailmap.file`, `mailmap.blob`) gives that
 * person, so a person under two addresses reads as one, and the author's own
 * alias reads as the author. A trailer without an address, and every other
 * trailer, stays as written.
 *
 * Costs one `git check-mailmap --stdin` for the whole run, and none when no
 * commit has a co-author trailer. A git that cannot answer (one too old for
 * `--stdin`) leaves the trailers as written.
 *
 * Git must run in the repository root.
 */
export const resolveCoAuthors = (
  commits: ReadonlyArray<Commit>,
): Effect.Effect<ReadonlyArray<Commit>, never, Git> =>
  Effect.gen(function* () {
    const lookups = lookupsOf(commits);
    if (lookups.length === 0) {
      return commits;
    }
    const resolved = yield* resolve(lookups);
    if (resolved.size === 0) {
      return commits;
    }
    return commits.map((commit) => ({
      ...commit,
      trailers: commit.trailers.map((trailer) => {
        const lookup = isCoAuthor(trailer)
          ? lookupOf(trailer.value)
          : undefined;
        const value = lookup === undefined ? undefined : resolved.get(lookup);
        return value === undefined ? trailer : { ...trailer, value };
      }),
    }));
  });
