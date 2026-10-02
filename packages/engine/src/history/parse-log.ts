// Owns reading `git log -z --raw --numstat` output, incrementally.
//
// The log is requested with the format in `LOG_FORMAT_ARGS`. Each commit then
// arrives as NUL-terminated tokens:
//   \u0001<sha> NUL <10 header fields, NUL-terminated> [\n]<raw entries><numstat entries>
// The header fields are the parents, author time, committer time, author date with offset,
// author and committer name and email, the unfolded trailers, and the message.
// A raw entry is `:<modes> <ids> <status>` followed by one path token, or two
// (old and new) for a rename or copy; it tells which files the commit deletes.
// A numstat entry is `<added>\t<deleted>\t<path>`. A rename entry has an empty
// path after the counts and is followed by two more tokens, the old and the
// new path. Binary files show `-` for counts.

import { parseMarkers, parseTrailers } from "./message.js";
import type { Trailer } from "./message.js";

/** One file touched by a commit. */
type Change = {
  /** Path after the commit (the new path of a rename). */
  readonly path: string;
  /** Set when the commit renamed the file. */
  readonly renamedFrom?: string;
  /** Set when the commit deletes the file; a rename's old path is not a deletion. */
  readonly removed?: true;
  /** 0 for binary files. */
  readonly added: number;
  readonly deleted: number;
};

/** A name and email as git prints them, after `.mailmap`. */
type Person = { readonly name: string; readonly email: string };

export type Commit = {
  readonly sha: string;
  /** The parents as git shows them: none for a root or a shallow boundary, several for a merge. */
  readonly parents: ReadonlyArray<string>;
  /** Author time in seconds since the epoch; NaN when git cannot read the date (a negative or malformed one). */
  readonly time: number;
  /** Committer time in seconds since the epoch; NaN when git cannot read the date. */
  readonly committerTime: number;
  /** The author's UTC offset in minutes, as in the author date. */
  readonly offsetMinutes: number;
  readonly author: Person;
  readonly committer: Person;
  /** The first line of the commit message, trimmed; empty for an empty message. */
  readonly subject: string;
  /** Every trailer in message order, with whitespace collapsed. */
  readonly trailers: ReadonlyArray<Trailer>;
  /**
   * Trimmed lines of the message that name a tool, such as "Generated with
   * [Claude Code](...)", and `Co-authored-by: Name <email>` lines that git did
   * not parse as trailers (a squash merge indents them or buries them in the body).
   */
  readonly markers: ReadonlyArray<string>;
  readonly changes: ReadonlyArray<Change>;
};

/** Bump on any change to how commits, trailers, markers, subjects, renames or removals are parsed. */
export const PARSER_VERSION = 4;

/**
 * Arguments that make `git log` print what `LogParser` reads. Merge commits
 * are printed, without a diff, so that the commit graph stays connected.
 */
export const LOG_FORMAT_ARGS = [
  "--diff-merges=off",
  "-M",
  "--raw",
  "--numstat",
  "-z",
  "--use-mailmap",
  "--no-show-signature",
  "--format=%x01%H%x00%P%x00%at%x00%ct%x00%aI%x00%aN%x00%aE%x00%cN%x00%cE%x00%(trailers:unfold,separator=%x1f)%x00%B%x00",
] as const;

const COMMIT_MARKER = "\u0001";
const HEADER_FIELDS = 10;
const OFFSET = /([+-])(\d{2}):(\d{2})$/u;
const NUMSTAT = /^(\d+|-)\t(\d+|-)\t(.*)$/su;
const RAW_STATUS = /^:\d+ \d+ \w+ \w+ ([A-Z])\d*$/u;

type Phase = "header" | "entry" | "rawPath" | "renamedFrom" | "renamedTo";

type OpenCommit = Omit<Commit, "changes"> & { changes: Array<Change> };

const secondsOf = (field: string | undefined): number =>
  field === undefined || field === "" ? NaN : Number(field);

const lineCount = (field: string | undefined): number =>
  field === undefined || field === "-" ? 0 : Number(field);

const offsetMinutesOf = (date: string): number => {
  const [, sign, hours = "0", minutes = "0"] = OFFSET.exec(date) ?? [];
  const total = Number(hours) * 60 + Number(minutes);
  return sign === "-" ? -total : total;
};

const openCommit = (sha: string, fields: ReadonlyArray<string>): OpenCommit => {
  const [
    parents,
    time,
    committerTime,
    date,
    authorName,
    authorEmail,
    committerName,
    committerEmail,
    trailers,
    message,
  ] = fields;
  const parsedTrailers = parseTrailers(trailers ?? "");
  return {
    sha,
    parents: (parents ?? "").split(" ").filter((parent) => parent !== ""),
    time: secondsOf(time),
    committerTime: secondsOf(committerTime),
    offsetMinutes: offsetMinutesOf(date ?? ""),
    author: { name: authorName ?? "", email: authorEmail ?? "" },
    committer: { name: committerName ?? "", email: committerEmail ?? "" },
    subject: (message ?? "").split("\n", 1)[0]?.trim() ?? "",
    trailers: parsedTrailers,
    markers: parseMarkers(message ?? "", parsedTrailers),
    changes: [],
  };
};

/**
 * Turns chunks of log output into commits. It holds the state between
 * chunks, so use one instance per log.
 */
export class LogParser {
  #tail = "";
  #phase: Phase = "entry";
  #open: OpenCommit | undefined;
  #sha = "";
  #header: Array<string> = [];
  #counts = { added: 0, deleted: 0 };
  #renamedFrom = "";
  /** Paths the open commit deletes, from its raw entries. */
  #removed = new Set<string>();
  #rawPaths = 0;
  #rawStatus = "";

  /** Consumes the next piece of output and returns the commits it completed. */
  push(chunk: string): ReadonlyArray<Commit> {
    const tokens = (this.#tail + chunk).split("\0");
    this.#tail = tokens.pop() ?? "";
    return tokens.flatMap((token) => this.#consume(token));
  }

  /** Returns the last commit; call once after the final `push`. */
  end(): ReadonlyArray<Commit> {
    const last = this.#tail === "" ? [] : this.#consume(this.#tail);
    this.#tail = "";
    return [...last, ...this.#close()];
  }

  #consume(token: string): ReadonlyArray<Commit> {
    if (this.#phase === "header") {
      this.#readHeaderField(token);
      return [];
    }
    if (this.#phase === "rawPath") {
      this.#readRawPath(token);
      return [];
    }
    if (this.#phase === "renamedFrom") {
      this.#renamedFrom = token;
      this.#phase = "renamedTo";
      return [];
    }
    if (this.#phase === "renamedTo") {
      return this.#readRenamedTo(token);
    }
    return token.startsWith(COMMIT_MARKER)
      ? this.#begin(token.slice(COMMIT_MARKER.length))
      : this.#readEntry(token);
  }

  #readRenamedTo(path: string): ReadonlyArray<Commit> {
    this.#open?.changes.push({
      path,
      renamedFrom: this.#renamedFrom,
      ...this.#counts,
    });
    this.#phase = "entry";
    return [];
  }

  #close(): ReadonlyArray<Commit> {
    const finished = this.#open;
    this.#open = undefined;
    return finished === undefined ? [] : [finished];
  }

  #begin(sha: string): ReadonlyArray<Commit> {
    const finished = this.#close();
    this.#sha = sha;
    this.#header = [];
    this.#removed = new Set();
    this.#phase = "header";
    return finished;
  }

  #readHeaderField(token: string): void {
    this.#header.push(token);
    if (this.#header.length === HEADER_FIELDS) {
      this.#open = openCommit(this.#sha, this.#header);
      this.#phase = "entry";
    }
  }

  #readRawPath(path: string): void {
    if (this.#rawStatus === "D") {
      this.#removed.add(path);
    }
    this.#rawPaths -= 1;
    if (this.#rawPaths === 0) {
      this.#phase = "entry";
    }
  }

  #readEntry(token: string): ReadonlyArray<Commit> {
    const entry = token.replace(/^\n/u, "");
    const status = RAW_STATUS.exec(entry)?.[1];
    if (status !== undefined) {
      this.#rawStatus = status;
      this.#rawPaths = status === "R" || status === "C" ? 2 : 1;
      this.#phase = "rawPath";
      return [];
    }
    const match = NUMSTAT.exec(entry);
    if (this.#open === undefined || match === null) {
      return [];
    }
    const [, added, deleted, path = ""] = match;
    this.#counts = { added: lineCount(added), deleted: lineCount(deleted) };
    if (path === "") {
      this.#phase = "renamedFrom";
    } else {
      this.#open.changes.push({
        path,
        ...this.#counts,
        ...(this.#removed.has(path) ? { removed: true } : {}),
      });
    }
    return [];
  }
}
