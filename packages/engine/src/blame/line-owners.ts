// Owns turning per-file blame into the line owners of a set of files.
// Counts every author, bots and agents included, and marks which they are.

import { Order } from "effect";

import { authorKind } from "../automation/classify.js";
import type { Signature } from "../automation/signatures.js";
import { roundReported } from "../report/precision.js";
import type { Report } from "../report/report.js";
import type { LineAuthors } from "./parse-blame.js";

/** The owners of a set of files, as the report shows them. */
export type LineOwners = NonNullable<
  Report["knowledge"]["directories"][number]["lineOwners"]
>;

type LineOwner = LineOwners["owners"][number];

const MAX_OWNERS = 5;

/** What the owners of lines are read from. */
export type Ownership = {
  /** The authors of every blamed universe file, by path. */
  readonly files: ReadonlyMap<string, LineAuthors>;
  /** The universe files whose blame failed. */
  readonly failed: ReadonlySet<string>;
  /** The identities of the history, by email, which name an author as the rest of the report does. */
  readonly signatures: ReadonlyArray<Signature>;
  readonly identities: ReadonlyMap<string, { readonly name: string }>;
};

type Counted = Pick<LineOwner, "name" | "email" | "lines">;

const byLinesThenName = Order.combine(
  Order.flip(Order.mapInput(Order.Number, (owner: Counted) => owner.lines)),
  Order.combine(
    Order.mapInput(Order.String, (owner: Counted) => owner.name),
    Order.mapInput(Order.String, (owner: Counted) => owner.email),
  ),
);

/**
 * The five authors with the most lines among `paths`, the lines of all
 * authors together, and how many of the paths git failed to blame. A path
 * without blame adds no lines. A name comes from the history when the
 * email appears there, from blame otherwise.
 */
export const lineOwnersOf = (
  paths: ReadonlyArray<string>,
  { files, failed, identities, signatures }: Ownership,
): LineOwners => {
  const byEmail = new Map<string, { name: string; lines: number }>();
  let lines = 0;
  for (const path of paths) {
    for (const [email, author] of files.get(path) ?? []) {
      const total = byEmail.get(email);
      byEmail.set(email, {
        name: total?.name ?? author.name,
        lines: (total?.lines ?? 0) + author.lines,
      });
      lines += author.lines;
    }
  }
  const owners = [...byEmail]
    .map(([email, total]) => ({
      email,
      name: identities.get(email)?.name ?? total.name,
      lines: total.lines,
    }))
    .toSorted(byLinesThenName)
    .slice(0, MAX_OWNERS)
    .map((owner): LineOwner =>
      Object.assign({}, owner, {
        share: roundReported(owner.lines / lines),
        kind: authorKind(owner, signatures),
      }),
    );
  return {
    skippedFiles: paths.filter((path) => failed.has(path)).length,
    lines,
    owners,
  };
};

/** `{ lineOwners }` when there are owners, nothing otherwise: the key is absent without `--blame`. */
export const lineOwnersField = (
  lineOwners: LineOwners | undefined,
): { readonly lineOwners?: LineOwners } =>
  lineOwners === undefined ? {} : { lineOwners };
