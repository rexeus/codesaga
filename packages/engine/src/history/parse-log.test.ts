import { describe, expect, it } from "vitest";

import { LogParser } from "./parse-log.js";

const parse = (chunks: ReadonlyArray<string>) => {
  const parser = new LogParser();
  return [...chunks.flatMap((chunk) => parser.push(chunk)), ...parser.end()];
};

type Header = {
  readonly sha: string;
  readonly parents?: ReadonlyArray<string>;
  readonly time?: number | string;
  readonly committerTime?: number | string;
  readonly date?: string;
  readonly author?: readonly [string, string];
  readonly committer?: readonly [string, string];
  readonly trailers?: ReadonlyArray<string>;
  readonly body?: string;
};

/** One commit's header as `--format` prints it, with its NUL-terminated fields. */
const header = ({
  sha,
  parents = [],
  time = 100,
  committerTime = time,
  date = "1970-01-01T00:01:40+00:00",
  author = ["Ada", "ada@example.com"],
  committer = author,
  trailers = [],
  body = "subject\n",
}: Header) =>
  `\u0001${sha}\0${parents.join(" ")}\0${time}\0${committerTime}\0${date}\0${author.join("\0")}\0${committer.join("\0")}\0` +
  `${trailers.join("\u001F")}\0${body}\0\0`;

describe("LogParser time", () => {
  it("reads the time of a date git cannot read as NaN, not as the epoch", () => {
    const [commit] = parse([
      header({ sha: "aaa", time: "", date: "%aI" }) + "\n1\t0\ta.ts\0",
    ]);

    expect(commit?.time).toBeNaN();
  });

  it("reads the committer time apart from the author time, NaN when git cannot read it", () => {
    const [dated, undated] = parse([
      header({ sha: "aaa", time: 100, committerTime: 700 }) + "\n1\t0\ta.ts\0",
      header({ sha: "bbb", time: 100, committerTime: "" }) + "\n1\t0\ta.ts\0",
    ]);

    expect(dated).toMatchObject({ time: 100, committerTime: 700 });
    expect(undated?.time).toBe(100);
    expect(undated?.committerTime).toBeNaN();
  });
});

describe("LogParser parents", () => {
  it("reads the parents of a root, a commit and a merge", () => {
    const parsed = parse([
      header({ sha: "a" }),
      header({ sha: "b", parents: ["a"] }),
      header({ sha: "m", parents: ["a", "b"] }),
    ]);

    expect(parsed.map(({ parents }) => parents)).toStrictEqual([
      [],
      ["a"],
      ["a", "b"],
    ]);
  });
});

describe("LogParser header", () => {
  it("reads author, committer, time and the author's UTC offset", () => {
    const raw = header({
      sha: "aaa",
      time: 1_772_000_000,
      date: "2026-02-25T12:23:20+05:30",
      author: ["Ada", "ada@example.com"],
      committer: ["Grace", "grace@example.com"],
    });

    expect(parse([raw])).toMatchObject([
      {
        sha: "aaa",
        time: 1_772_000_000,
        offsetMinutes: 330,
        author: { name: "Ada", email: "ada@example.com" },
        committer: { name: "Grace", email: "grace@example.com" },
      },
    ]);
  });

  it("reads a negative offset", () => {
    const raw = header({ sha: "a", date: "2026-02-25T05:00:00-08:00" });

    expect(parse([raw])[0]?.offsetMinutes).toBe(-480);
  });

  it("reads two co-author trailers and a marker trailer, with whitespace collapsed", () => {
    const raw = header({
      sha: "b",
      trailers: [
        "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>",
        "co-authored-by:   Jane   Doe <jane@example.com>",
        "Made-with: Cursor",
      ],
    });

    expect(parse([raw])[0]?.trailers).toStrictEqual([
      {
        key: "Co-Authored-By",
        value: "Claude Opus 4.8 <noreply@anthropic.com>",
      },
      { key: "co-authored-by", value: "Jane Doe <jane@example.com>" },
      { key: "Made-with", value: "Cursor" },
    ]);
  });

  it("reads a commit without trailers", () => {
    const [commit] = parse([header({ sha: "c" })]);

    expect(commit?.trailers).toStrictEqual([]);
    expect(commit?.markers).toStrictEqual([]);
  });

  it("keeps the 'Generated with' lines of the message as markers", () => {
    const body =
      "Fix it\n\nBody text that mentions Generated with care.\n\n" +
      "🤖 Generated with [Claude Code](https://claude.com/claude-code)\n";

    expect(parse([header({ sha: "d", body })])[0]?.markers).toStrictEqual([
      "🤖 Generated with [Claude Code](https://claude.com/claude-code)",
    ]);
  });

  it("keeps the commit marker character inside a message", () => {
    const raw = header({ sha: "e", body: "a\u0001b\n" }) + header({ sha: "f" });

    expect(parse([raw]).map((commit) => commit.sha)).toStrictEqual(["e", "f"]);
  });
});

describe("LogParser changes", () => {
  it("parses commits with their changed files", () => {
    const raw =
      `${header({ sha: "aaa", time: 200 })}\n3\t1\tsrc/a.ts\0` +
      "0\t5\tsrc/b.ts\0" +
      `${header({ sha: "bbb" })}\n10\t0\tREADME.md\0`;

    expect(
      parse([raw]).map(({ sha, time, changes }) => ({ sha, time, changes })),
    ).toStrictEqual([
      {
        sha: "aaa",
        time: 200,
        changes: [
          { path: "src/a.ts", added: 3, deleted: 1 },
          { path: "src/b.ts", added: 0, deleted: 5 },
        ],
      },
      {
        sha: "bbb",
        time: 100,
        changes: [{ path: "README.md", added: 10, deleted: 0 }],
      },
    ]);
  });

  it("counts a binary file as a change of zero lines", () => {
    const raw = `${header({ sha: "c" })}\n-\t-\timage.png\0`;

    expect(parse([raw])[0]?.changes).toStrictEqual([
      { path: "image.png", added: 0, deleted: 0 },
    ]);
  });

  it("reads a rename as the new path with the old path it came from", () => {
    const raw = `${header({ sha: "d" })}\n2\t1\t\0old name.ts\0new.ts\u00004\t0\tother.ts\0`;

    expect(parse([raw])[0]?.changes).toStrictEqual([
      { path: "new.ts", renamedFrom: "old name.ts", added: 2, deleted: 1 },
      { path: "other.ts", added: 4, deleted: 0 },
    ]);
  });

  it("keeps a commit without changes", () => {
    const raw = `${header({ sha: "e" })}${header({ sha: "f" })}\n1\t1\tz.ts\0`;

    expect(
      parse([raw]).map(({ sha, changes }) => ({ sha, changes })),
    ).toStrictEqual([
      { sha: "e", changes: [] },
      { sha: "f", changes: [{ path: "z.ts", added: 1, deleted: 1 }] },
    ]);
  });

  it("keeps tabs, newlines, and non-ASCII characters inside a path", () => {
    const raw = `${header({ sha: "g" })}\n1\t0\tdir/we\tird\nnäme.ts\0`;

    expect(parse([raw])[0]?.changes).toStrictEqual([
      { path: "dir/we\tird\nnäme.ts", added: 1, deleted: 0 },
    ]);
  });
});

describe("LogParser deletions", () => {
  it("marks the file a commit deletes, and not a modified, added or renamed one", () => {
    const raw =
      `${header({ sha: "d" })}\n` +
      ":100644 100644 f00c965 f00c965 R100\0old.ts\0new.ts\0" +
      ":000000 100644 0000000 30bf1cc A\0added.ts\0" +
      ":100644 000000 587be6b 0000000 D\0dir/gone.ts\0" +
      ":100644 100644 3e75765 337b506 M\0edited.ts\0" +
      "0\t0\t\0old.ts\0new.ts\0" +
      "11\t0\tadded.ts\0" +
      "0\t7\tdir/gone.ts\0" +
      "1\t1\tedited.ts\0";

    expect(
      parse([raw])[0]?.changes.map(({ path, removed }) => ({ path, removed })),
    ).toStrictEqual([
      { path: "new.ts", removed: undefined },
      { path: "added.ts", removed: undefined },
      { path: "dir/gone.ts", removed: true },
      { path: "edited.ts", removed: undefined },
    ]);
  });

  it("does not carry a deletion over to the next commit's file of the same name", () => {
    const raw =
      `${header({ sha: "e" })}\n:100644 000000 587be6b 0000000 D\0a.ts\0` +
      "0\t3\ta.ts\0" +
      `${header({ sha: "f" })}\n:000000 100644 0000000 587be6b A\0a.ts\0` +
      "3\t0\ta.ts\0";

    expect(
      parse([raw]).map(({ changes }) => changes.map(({ removed }) => removed)),
    ).toStrictEqual([[true], [undefined]]);
  });
});

const id = (digit: string, length = 40) => digit.repeat(length);
const wide = (digit: string) => id(digit, 64);

describe("LogParser blobs", () => {
  const zero = id("0");

  it("reads full blob ids and the new mode of an add, a modify, a delete, a rename and a symlink", () => {
    const raw =
      `${header({ sha: "b" })}\n` +
      `:000000 100644 ${zero} ${id("a")} A\0added.ts\0` +
      `:100644 100755 ${id("b")} ${id("c")} M\0edited.ts\0` +
      `:100644 000000 ${id("d")} ${zero} D\0gone.ts\0` +
      `:100644 100644 ${id("e")} ${id("f")} R087\0old.ts\0new.ts\0` +
      `:000000 120000 ${zero} ${id("1")} A\0link.ts\0` +
      "1\t0\tadded.ts\0" +
      "1\t1\tedited.ts\0" +
      "0\t4\tgone.ts\0" +
      "2\t1\t\0old.ts\0new.ts\0" +
      "1\t0\tlink.ts\0";

    expect(parse([raw])[0]?.changes).toStrictEqual([
      { path: "added.ts", added: 1, deleted: 0, oid: id("a"), mode: "100644" },
      {
        path: "edited.ts",
        added: 1,
        deleted: 1,
        oid: id("c"),
        previousOid: id("b"),
        mode: "100755",
        previousMode: "100644",
      },
      {
        path: "gone.ts",
        added: 0,
        deleted: 4,
        previousOid: id("d"),
        previousMode: "100644",
        removed: true,
      },
      {
        path: "new.ts",
        renamedFrom: "old.ts",
        added: 2,
        deleted: 1,
        oid: id("f"),
        previousOid: id("e"),
        mode: "100644",
        previousMode: "100644",
      },
      { path: "link.ts", added: 1, deleted: 0, oid: id("1"), mode: "120000" },
    ]);
  });
});

describe("LogParser blobs of a SHA-256 repository", () => {
  it("reads 64-digit blob ids", () => {
    const raw =
      `${header({ sha: "s" })}\n` +
      `:100644 100644 ${wide("a")} ${wide("b")} M\0a.ts\0` +
      "1\t1\ta.ts\0";

    expect(parse([raw])[0]?.changes).toStrictEqual([
      {
        path: "a.ts",
        added: 1,
        deleted: 1,
        oid: wide("b"),
        previousOid: wide("a"),
        mode: "100644",
        previousMode: "100644",
      },
    ]);
  });
});

describe("LogParser chunking", () => {
  it("yields the same commits however the output is split into chunks", () => {
    const raw =
      `${header({ sha: "aaa", trailers: ["Made-with: Cursor"] })}\n` +
      ":100644 100644 3e75765 337b506 M\0src/a.ts\0" +
      ":100644 100644 f00c965 f00c965 R100\0old.ts\0new.ts\0" +
      "3\t1\tsrc/a.ts\0" +
      "2\t1\t\0old.ts\0new.ts\0" +
      `${header({ sha: "bbb", author: ["Zoë", "z@example.com"] })}\n` +
      ":100644 000000 587be6b 0000000 D\0logo.png\0" +
      "-\t-\tlogo.png\0";

    const whole = parse([raw]);
    const bySingleCharacters = parse(raw.split(""));

    expect(whole).toHaveLength(2);
    expect(bySingleCharacters).toStrictEqual(whole);
  });

  it("returns nothing for empty output", () => {
    expect(parse([])).toStrictEqual([]);
    expect(parse([""])).toStrictEqual([]);
  });
});

describe("LogParser subject", () => {
  it("takes the first line of the message as the subject", () => {
    const body = "  Drop the legacy flow \n\nLonger text.\n";

    expect(parse([header({ sha: "s", body })])[0]?.subject).toBe(
      "Drop the legacy flow",
    );
  });
});
