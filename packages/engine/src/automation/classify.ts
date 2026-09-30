// Owns deciding which class a commit has, and which tool made it.
// First match wins: agent, bot, agent-assisted, human; signatures come from signatures.ts.
// A missing marker means "not detected", so it classifies as human.

import type { Identity } from "../people/identities.js";
import { SIGNATURES } from "./signatures.js";

// @scaffold links the table into the module graph; the body reads it once implemented.
void SIGNATURES;

/** The four classes of a commit, in the order they are checked. */
type CommitClass = "agent" | "bot" | "agent-assisted" | "human";

/** A name and email as git prints them. */
type Person = { readonly name: string; readonly email: string };

/** What classification reads from a commit. */
type CommitSignals = {
  readonly author: Person;
  readonly committer: Person;
  readonly trailers: ReadonlyArray<{
    readonly key: string;
    readonly value: string;
  }>;
  /** Tool marker lines of the message body, such as "Generated with [Claude Code]". */
  readonly markers: ReadonlyArray<string>;
};

/** The outcome of classification. */
type Classification = {
  readonly class: CommitClass;
  /** The matched signature's name; undefined for a human commit and for a bot matched only by the generic `[bot]` rule. */
  readonly tool: string | undefined;
};

/** The lines one commit added to and deleted from one file. */
type FileChange = {
  readonly path: string;
  readonly added: number;
  readonly deleted: number;
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

/**
 * Assigns the commit its class and tool. An agent author wins over the bot
 * rule; a bot author over a co-author; a human author with an agent trailer,
 * marker or committer is agent-assisted; everything else is human.
 */
export const classifyCommit = (_signals: CommitSignals): Classification => {
  throw new Error("@scaffold not implemented");
};
