import { describe, expect, it } from "vitest";

import { LogParser } from "./parse-log.js";

const parse = (chunks: ReadonlyArray<string>) => {
  const parser = new LogParser();
  return [...chunks.flatMap((chunk) => parser.push(chunk)), ...parser.end()];
};

type Header = {
  readonly sha: string;
  readonly time?: number;
  readonly date?: string;
  readonly author?: readonly [string, string];
  readonly committer?: readonly [string, string];
  readonly trailers?: ReadonlyArray<string>;
  readonly body?: string;
};

/** One commit's header as `--format` prints it, with its NUL-terminated fields. */
const header = ({
  sha,
  time = 100,
  date = "1970-01-01T00:01:40+00:00",
  author = ["Ada", "ada@example.com"],
  committer = author,
  trailers = [],
  body = "subject\n",
}: Header) =>
  `\u0001${sha}\0${time}\0${date}\0${author.join("\0")}\0${committer.join("\0")}\0` +
  `${trailers.join("\u001F")}\0${body}\0\0`;

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

describe("LogParser chunking", () => {
  it("yields the same commits however the output is split into chunks", () => {
    const raw =
      `${header({ sha: "aaa", trailers: ["Made-with: Cursor"] })}\n3\t1\tsrc/a.ts\0` +
      "2\t1\t\0old.ts\0new.ts\0" +
      `${header({ sha: "bbb", author: ["Zoë", "z@example.com"] })}\n-\t-\tlogo.png\0`;

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
