// Owns reading `git blame --line-porcelain` output, incrementally.
//
// In that format every line of the file is described on its own: a header
// (`<sha> <original line> <final line> [<group size>]`, then `author`,
// `author-mail`, `committer` and more key-value lines, `boundary` for the
// root commit), and the line itself behind one tab. Only the tab-prefixed
// line can hold file content, so a content line never passes for a header.
// Git has applied `.mailmap` to `author` and `author-mail` by then.
//
// Lines split on "\n" only: a lone "\r" is content, and treating it as a
// separator would let a file forge a header.

/** The lines one author has in a file. */
type LineCount = { readonly name: string; readonly lines: number };

/** The non-blank lines of one file by author, keyed by lowercased email. */
export type LineAuthors = ReadonlyMap<string, LineCount>;

/** The arguments that make `git blame` print what `BlameParser` reads, for one file at HEAD. */
export const blameArgs = (file: string): ReadonlyArray<string> => [
  "blame",
  "--line-porcelain",
  "-w",
  "HEAD",
  "--",
  file,
];

const AUTHOR = "author ";
const AUTHOR_MAIL = "author-mail ";
const ANGLE_BRACKETS = /^<|>$/gu;

export class BlameParser {
  #tail = "";
  #name = "";
  #email = "";
  readonly #authors = new Map<string, LineCount>();

  /** Consumes the next piece of output. */
  push(chunk: string): void {
    const lines = (this.#tail + chunk).split("\n");
    this.#tail = lines.pop() ?? "";
    for (const line of lines) {
      this.#consume(line);
    }
  }

  /** The lines per author; call once after the final `push`. */
  end(): LineAuthors {
    if (this.#tail !== "") {
      this.#consume(this.#tail);
      this.#tail = "";
    }
    return this.#authors;
  }

  #consume(line: string): void {
    if (line.startsWith("\t")) {
      // Blank lines are not code: the universe's line counts leave them out too.
      if (line.trim() !== "") {
        this.#count();
      }
    } else if (line.startsWith(AUTHOR)) {
      this.#name = line.slice(AUTHOR.length);
    } else if (line.startsWith(AUTHOR_MAIL)) {
      this.#email = line
        .slice(AUTHOR_MAIL.length)
        .replace(ANGLE_BRACKETS, "")
        .toLowerCase();
    }
  }

  #count(): void {
    const before = this.#authors.get(this.#email);
    this.#authors.set(this.#email, {
      name: this.#name,
      lines: (before?.lines ?? 0) + 1,
    });
  }
}
