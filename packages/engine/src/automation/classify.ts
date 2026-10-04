// Owns deciding which class a commit has, and which tools made it.
// First match wins: agent, bot, agent-assisted, human; signatures come from signatures.ts.
// A bot is a row of the table or an account named like one: `[bot]`, `-bot`, `_bot`.
// A missing marker means "not detected", so it classifies as human.

import type { FileChange, HistoryCommit } from "../history/history.js";
import type { Identity } from "../people/identities.js";
import { SIGNATURES } from "./signatures.js";
import type { PersonPattern, Signature } from "./signatures.js";

/** The four classes of a commit, in the order they are checked. */
type CommitClass = "agent" | "bot" | "agent-assisted" | "human";

type Person = HistoryCommit["author"];

/** What classification reads from a commit. */
type CommitSignals = Pick<
  HistoryCommit,
  "author" | "committer" | "trailers" | "markers"
>;

/** The outcome of classification. */
type Classification = {
  readonly class: CommitClass;
  /**
   * The matched signatures' names, or the account name of a bot that only the
   * generic bot-account rule matched; empty for a human commit. An agent-assisted
   * commit lists every agent it carries, once each, in table order.
   */
  readonly tools: ReadonlyArray<string>;
};

/** A commit with its author identity and class: the input of every activity section. */
export type ClassifiedCommit = Classification & {
  /** Author time in seconds since the epoch. */
  readonly time: number;
  /** The author's UTC offset in minutes, as in `%aI`. */
  readonly offsetMinutes: number;
  /** The first line of the commit message; empty when there is none. */
  readonly subject: string;
  readonly author: Identity;
  /**
   * How many other people the commit's `Co-authored-by` trailers name: those
   * that match no agent or bot signature and are not the author. Zero when
   * there is none, and for a co-author line that git did not parse as a trailer.
   */
  readonly humanCoAuthors: number;
  /** Changes after rename resolution, every path, code or not, cut to the analysis scope. */
  readonly changes: ReadonlyArray<FileChange>;
  /** How many files the commit changed in the whole repository, whatever the scope: `changes` is shorter in a scoped analysis. */
  readonly changedFiles: number;
};

const GITHUB_NOREPLY = /^(\d+)\+.+@users\.noreply\.github\.com$/iu;
const BOT_ACCOUNT = /(?:\[bot\]|(?:^|[-_])bot)$/iu;
const NOREPLY_LOGIN = /^(?:\d+\+)?(.+)@users\.noreply\.github\.com$/iu;
const PERSON_WITH_EMAIL = /^(.*?)\s*<([^>]*)>$/u;
const ADDRESS = /^[^@\s]+@[^@\s]+$/u;
const BODY_CO_AUTHOR = /^co-authored-by:\s*[^<>]*<([^<>]+)>\s*$/iu;

const githubIdOf = (email: string): number | undefined => {
  const id = GITHUB_NOREPLY.exec(email)?.[1];
  return id === undefined ? undefined : Number(id);
};

const isPerson = (pattern: PersonPattern, person: Person): boolean =>
  pattern.email === person.email.toLowerCase() ||
  pattern.name?.test(person.name) === true ||
  (pattern.githubId !== undefined &&
    pattern.githubId === githubIdOf(person.email));

const isSignedBy = (signature: Signature, person: Person): boolean =>
  signature.people?.some((pattern) => isPerson(pattern, person)) === true;

/**
 * Whether a name or login is a machine account by its spelling: it ends in
 * `[bot]`, `-bot` or `_bot`, or is `bot`, in any case. `Abbot` and `Talbot` end
 * in the letters but not in the word.
 */
export const isBotAccount = (name: string): boolean =>
  BOT_ACCOUNT.test(name.trim());

/** The account name of a bot author by spelling, in its name or in its noreply address. */
const botAccountOf = (person: Person): string | undefined => {
  if (isBotAccount(person.name)) {
    return person.name;
  }
  const login = NOREPLY_LOGIN.exec(person.email)?.[1];
  return login !== undefined && isBotAccount(login) ? login : undefined;
};

/** A `Co-authored-by` value is `Name <email>`; a bare value counts as a name. */
const coAuthorsOf = (signals: CommitSignals): ReadonlyArray<Person> =>
  signals.trailers
    .filter(({ key }) => key.toLowerCase() === "co-authored-by")
    .map(({ value }) => {
      const [, name = value, email = ""] = PERSON_WITH_EMAIL.exec(value) ?? [];
      return { name, email };
    });

/**
 * Co-author lines in the body that git did not parse as trailers, as people
 * known by address only: the squash-merge fallback matches an agent's email or
 * GitHub ID, never a name that a sentence could mention.
 */
const bodyCoAuthorsOf = (signals: CommitSignals): ReadonlyArray<Person> =>
  signals.markers.flatMap((line) => {
    const email = BODY_CO_AUTHOR.exec(line)?.[1];
    return email === undefined ? [] : [{ name: "", email }];
  });

const hasMarkerTrailer = (
  signature: Signature,
  signals: CommitSignals,
): boolean =>
  signals.trailers.some(({ key, value }) =>
    (signature.trailers ?? []).some(
      (pattern) =>
        pattern.key.toLowerCase() === key.toLowerCase() &&
        (pattern.value?.test(value) ?? true),
    ),
  );

const hasMarkerLine = (signature: Signature, signals: CommitSignals): boolean =>
  signals.markers.some((line) =>
    (signature.messageLines ?? []).some((pattern) => pattern.test(line)),
  );

/** Every agent that committed, co-authored or marked a commit that a human authored. */
const assistingAgentsOf = (
  signals: CommitSignals,
  signatures: ReadonlyArray<Signature>,
): ReadonlyArray<string> => {
  const helpers = [
    signals.committer,
    ...coAuthorsOf(signals),
    ...bodyCoAuthorsOf(signals),
  ];
  const names = signatures
    .filter(
      (signature) =>
        signature.kind === "agent" &&
        (helpers.some((person) => isSignedBy(signature, person)) ||
          hasMarkerTrailer(signature, signals) ||
          hasMarkerLine(signature, signals)),
    )
    .map(({ name }) => name);
  return [...new Set(names)];
};

/** The agent or bot an author account belongs to, or undefined for a person. */
const automatedAuthorOf = (
  author: Person,
  signatures: ReadonlyArray<Signature>,
): (Classification & { readonly class: "agent" | "bot" }) | undefined => {
  const signature = signatures.find((candidate) =>
    isSignedBy(candidate, author),
  );
  if (signature !== undefined) {
    return { class: signature.kind, tools: [signature.name] };
  }
  const botAccount = botAccountOf(author);
  return botAccount === undefined
    ? undefined
    : { class: "bot", tools: [botAccount] };
};

/**
 * The number of distinct people, by lowercased address, that the parsed
 * `Co-authored-by` trailers name besides the author. A trailer counts only in
 * the shape `Name <address>`; `Co-authored-by: broken` names nobody. Addresses
 * are compared as given, so the history has already resolved them through
 * `.mailmap` (see `readHistory`). A person is anyone who matches no row of `signatures` and no bot account, so a team's own
 * signatures count. Needs only the trailers: the human share of a commit's
 * help is a fact about the commit, whatever its class.
 */
export const humanCoAuthorsOf = (
  signals: CommitSignals,
  signatures: ReadonlyArray<Signature> = SIGNATURES,
): number => {
  const author = signals.author.email.toLowerCase();
  const people = coAuthorsOf(signals)
    .filter(({ email }) => ADDRESS.test(email))
    .filter((person) => automatedAuthorOf(person, signatures) === undefined)
    .map(({ email }) => email.toLowerCase())
    .filter((key) => key !== author);
  return new Set(people).size;
};

/**
 * Assigns the commit its class and tools. An agent author wins over the bot
 * rule; a bot author over a co-author; a human author with an agent trailer,
 * marker or committer is agent-assisted by every agent it carries; everything
 * else is human.
 *
 * `signatures` is the table to match against, the built-in one by default; for
 * the author, the first matching row wins.
 */
export const classifyCommit = (
  signals: CommitSignals,
  signatures: ReadonlyArray<Signature> = SIGNATURES,
): Classification => {
  const automated = automatedAuthorOf(signals.author, signatures);
  if (automated !== undefined) {
    return automated;
  }
  const assistants = assistingAgentsOf(signals, signatures);
  return assistants.length === 0
    ? { class: "human", tools: [] }
    : { class: "agent-assisted", tools: assistants };
};

/**
 * Whether an author account is an agent, a bot, or a person. Only the account
 * is judged, with the rules of `classifyCommit` for authors: trailers and
 * markers belong to a commit, not to the lines it left behind.
 */
export const authorKind = (
  author: Person,
  signatures: ReadonlyArray<Signature> = SIGNATURES,
): "agent" | "bot" | "human" =>
  automatedAuthorOf(author, signatures)?.class ?? "human";

/** Whether the commit counts for a person: a human wrote it, possibly with an agent's help. */
export const isContributorCommit = ({ class: commitClass }: Classification) =>
  commitClass === "human" || commitClass === "agent-assisted";
