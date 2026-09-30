// Owns reading `git log -z --numstat` output, incrementally.
//
// The log is requested with the format in `LOG_FORMAT_ARGS`. Each commit then
// arrives as NUL-terminated tokens:
//   \u0001<sha> NUL <8 header fields, NUL-terminated> [\n]<added>\t<deleted>\t<path> NUL ...
// The header fields are author time, author date with offset, author and
// committer name and email, the unfolded trailers, and the message. A rename
// entry has an empty path after the counts and is followed by two more
// tokens, the old and the new path. Binary files show `-` for counts.

/** One file touched by a commit. */
type Change = {
  /** Path after the commit (the new path of a rename). */
  readonly path: string;
  /** Set when the commit renamed the file. */
  readonly renamedFrom?: string;
  /** 0 for binary files. */
  readonly added: number;
  readonly deleted: number;
};

/** A name and email as git prints them, after `.mailmap`. */
type Person = { readonly name: string; readonly email: string };

/** One `Key: value` line of a commit's trailer block. */
type Trailer = { readonly key: string; readonly value: string };

export type Commit = {
  readonly sha: string;
  /** Author time in seconds since the epoch; NaN when git cannot read the date (a negative or malformed one). */
  readonly time: number;
  /** The author's UTC offset in minutes, as in the author date. */
  readonly offsetMinutes: number;
  readonly author: Person;
  readonly committer: Person;
  /** Every trailer in message order, with whitespace collapsed. */
  readonly trailers: ReadonlyArray<Trailer>;
  /** Lines of the message that name a tool, such as "Generated with [Claude Code](...)". */
  readonly markers: ReadonlyArray<string>;
  readonly changes: ReadonlyArray<Change>;
};

/** Arguments that make `git log` print what `LogParser` reads. */
export const LOG_FORMAT_ARGS = [
  "--no-merges",
  "-M",
  "--numstat",
  "-z",
  "--use-mailmap",
  "--no-show-signature",
  "--format=%x01%H%x00%at%x00%aI%x00%aN%x00%aE%x00%cN%x00%cE%x00%(trailers:unfold,separator=%x1f)%x00%B%x00",
] as const;

const COMMIT_MARKER = "\u0001";
const TRAILER_SEPARATOR = "\u001F";
const HEADER_FIELDS = 8;
const GENERATED_WITH = /^\W*Generated with \[[^\]]+\]/iu;
const OFFSET = /([+-])(\d{2}):(\d{2})$/u;
const NUMSTAT = /^(\d+|-)\t(\d+|-)\t(.*)$/su;

type Phase = "header" | "entry" | "renamedFrom" | "renamedTo";

type OpenCommit = Omit<Commit, "changes"> & { changes: Array<Change> };

const lineCount = (field: string | undefined): number =>
  field === undefined || field === "-" ? 0 : Number(field);

const offsetMinutesOf = (date: string): number => {
  const [, sign, hours = "0", minutes = "0"] = OFFSET.exec(date) ?? [];
  const total = Number(hours) * 60 + Number(minutes);
  return sign === "-" ? -total : total;
};

const parseTrailers = (field: string): ReadonlyArray<Trailer> =>
  field
    .split(TRAILER_SEPARATOR)
    .map((line) => [line.indexOf(":"), line] as const)
    .filter(([colon]) => colon > 0)
    .map(([colon, line]) => ({
      key: line.slice(0, colon).trim(),
      value: line
        .slice(colon + 1)
        .replaceAll(/\s+/gu, " ")
        .trim(),
    }));

const parseMarkers = (message: string): ReadonlyArray<string> =>
  message
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => GENERATED_WITH.test(line));

const openCommit = (sha: string, fields: ReadonlyArray<string>): OpenCommit => {
  const [time, date, authorName, authorEmail, committerName, committerEmail] =
    fields;
  return {
    sha,
    time: time === undefined || time === "" ? NaN : Number(time),
    offsetMinutes: offsetMinutesOf(date ?? ""),
    author: { name: authorName ?? "", email: authorEmail ?? "" },
    committer: { name: committerName ?? "", email: committerEmail ?? "" },
    trailers: parseTrailers(fields[6] ?? ""),
    markers: parseMarkers(fields[7] ?? ""),
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

  #readEntry(token: string): ReadonlyArray<Commit> {
    const match = NUMSTAT.exec(token.replace(/^\n/u, ""));
    if (this.#open === undefined || match === null) {
      return [];
    }
    const [, added, deleted, path = ""] = match;
    this.#counts = { added: lineCount(added), deleted: lineCount(deleted) };
    if (path === "") {
      this.#phase = "renamedFrom";
    } else {
      this.#open.changes.push({ path, ...this.#counts });
    }
    return [];
  }
}
