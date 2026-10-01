// Owns turning commit authors into identities: mailmap-normalized, lowercased emails.
// Names never merge people; `.mailmap` joins two emails before git prints them.
// Identities live in memory for one analysis, one entry per distinct email.

/** A person as the history sees them. */
export type Identity = {
  /** Lowercased, mailmap-normalized; the identity's key. */
  readonly email: string;
  /** The most recent name used with `email`. */
  readonly name: string;
};

/** One commit's author line. */
type Authorship = {
  readonly name: string;
  readonly email: string;
  /** Commit time in seconds since the epoch. */
  readonly time: number;
};

/**
 * One identity per distinct lowercased email, keyed by it. The display name is
 * the name of the newest authorship for that email; equal times keep the later
 * entry of `authorships`.
 */
export const buildIdentities = (
  authorships: ReadonlyArray<Authorship>,
): ReadonlyMap<string, Identity> => {
  const newest = new Map<string, Authorship>();
  for (const authorship of authorships) {
    const email = authorship.email.toLowerCase();
    const before = newest.get(email);
    if (before === undefined || authorship.time >= before.time) {
      newest.set(email, authorship);
    }
  }
  return new Map(
    [...newest].map(([email, { name }]) => [email, { email, name }]),
  );
};
