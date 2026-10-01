// Owns deciding which class a commit has, and which tools made it.
// First match wins: agent, bot, agent-assisted, human; signatures come from signatures.ts.
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
   * generic `[bot]` rule matched; empty for a human commit. An agent-assisted
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
  readonly author: Identity;
  /** Changes after rename resolution, every path, code or not. */
  readonly changes: ReadonlyArray<FileChange>;
};

const GITHUB_NOREPLY = /^(\d+)\+.+@users\.noreply\.github\.com$/iu;
const BOT_NAME = /\[bot\]$/iu;
const NOREPLY_BOT = /^(?:\d+\+)?(.+\[bot\])@users\.noreply\.github\.com$/iu;
const PERSON_WITH_EMAIL = /^(.*?)\s*<([^>]*)>$/u;

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

/** The account name of a `[bot]` author, in its name or in its noreply address. */
const botAccountOf = (person: Person): string | undefined =>
  BOT_NAME.test(person.name)
    ? person.name
    : NOREPLY_BOT.exec(person.email)?.[1];

/** A `Co-authored-by` value is `Name <email>`; a bare value counts as a name. */
const coAuthorsOf = (signals: CommitSignals): ReadonlyArray<Person> =>
  signals.trailers
    .filter(({ key }) => key.toLowerCase() === "co-authored-by")
    .map(({ value }) => {
      const [, name = value, email = ""] = PERSON_WITH_EMAIL.exec(value) ?? [];
      return { name, email };
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
const assistingAgentsOf = (signals: CommitSignals): ReadonlyArray<string> => {
  const helpers = [signals.committer, ...coAuthorsOf(signals)];
  const names = SIGNATURES.filter(
    (signature) =>
      signature.kind === "agent" &&
      (helpers.some((person) => isSignedBy(signature, person)) ||
        hasMarkerTrailer(signature, signals) ||
        hasMarkerLine(signature, signals)),
  ).map(({ name }) => name);
  return [...new Set(names)];
};

/**
 * Assigns the commit its class and tools. An agent author wins over the bot
 * rule; a bot author over a co-author; a human author with an agent trailer,
 * marker or committer is agent-assisted by every agent it carries; everything
 * else is human.
 */
export const classifyCommit = (signals: CommitSignals): Classification => {
  const authorSignature = SIGNATURES.find((signature) =>
    isSignedBy(signature, signals.author),
  );
  if (authorSignature !== undefined) {
    return { class: authorSignature.kind, tools: [authorSignature.name] };
  }
  const botAccount = botAccountOf(signals.author);
  if (botAccount !== undefined) {
    return { class: "bot", tools: [botAccount] };
  }
  const assistants = assistingAgentsOf(signals);
  return assistants.length === 0
    ? { class: "human", tools: [] }
    : { class: "agent-assisted", tools: assistants };
};

/** Whether the commit counts for a person: a human wrote it, possibly with an agent's help. */
export const isContributorCommit = ({ class: commitClass }: Classification) =>
  commitClass === "human" || commitClass === "agent-assisted";
