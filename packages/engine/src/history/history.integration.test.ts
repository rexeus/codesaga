import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";

import { Git } from "../git/git.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { readHistory } from "./history.js";
import type { HistoryCommit } from "./history.js";

// Ten distinct lines keep a file similar enough for git to detect a rename
// after one appended line.
const tenLines = Array.from(
  { length: 10 },
  (_, index) => `line ${index}\n`,
).join("");

const history = (
  repo: TempRepository,
  shallowBoundary: ReadonlySet<string> = new Set(),
) =>
  Effect.gen(function* () {
    const head = (yield* repo.git("rev-parse", "HEAD")).trim();
    const { commits } = yield* readHistory({
      root: repo.directory,
      head,
      shallowBoundary,
      useCache: false,
    });
    return commits;
  }).pipe(Effect.provide(Git.layer(repo.directory)));

/** a.ts is created, edited, renamed to b.ts, edited, renamed to c.ts, edited. */
const commitRenamedTwice = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit("2026-03-01T12:00:00Z", {
      "a.ts": tenLines,
      "other.ts": "x\n",
    });
    yield* repo.commit("2026-03-02T12:00:00Z", { "a.ts": `${tenLines}two\n` });
    yield* repo.git("mv", "a.ts", "b.ts");
    yield* repo.commit("2026-03-03T12:00:00Z");
    yield* repo.commit("2026-03-04T12:00:00Z", {
      "b.ts": `${tenLines}two\nfour\n`,
    });
    yield* repo.git("mv", "b.ts", "c.ts");
    yield* repo.commit("2026-03-05T12:00:00Z");
    yield* repo.commit("2026-03-06T12:00:00Z", {
      "c.ts": `${tenLines}two\nfour\nsix\n`,
    });
  });

layer(NodeServices.layer)("readHistory changes", (it) => {
  it.effect(
    "names every change of a file renamed twice by its current path, newest commit first",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* commitRenamedTwice(repo);

        const commits = yield* history(repo);

        assert.deepStrictEqual(
          commits.map((commit) => commit.changes.map(({ path }) => path)),
          [
            ["c.ts"],
            ["c.ts"],
            ["c.ts"],
            ["c.ts"],
            ["c.ts"],
            ["c.ts", "other.ts"],
          ],
        );
      }),
  );

  it.effect("leaves out the commits it is told to skip", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": "a\n" });
      yield* repo.commit("2026-03-02T12:00:00Z", { "a.ts": "a\nb\n" });
      const first = (yield* repo.git("rev-parse", "HEAD~1")).trim();

      const commits = yield* history(repo, new Set([first]));

      assert.deepStrictEqual(
        commits.map((commit) => commit.changes),
        [[{ path: "a.ts", added: 1, deleted: 0 }]],
      );
    }),
  );

  it.effect("counts binary files as changes of zero lines", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", {
        "blob.ts": new Uint8Array([97, 0, 98, 0]),
      });

      const [commit] = yield* history(repo);

      assert.deepStrictEqual(commit?.changes, [
        { path: "blob.ts", added: 0, deleted: 0 },
      ]);
    }),
  );
});

layer(NodeServices.layer)("readHistory renames", (it) => {
  it.effect(
    "marks the commits that renamed a file, under the file's current path",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* commitRenamedTwice(repo);

        const commits = yield* history(repo);

        assert.deepStrictEqual(
          commits.map((commit) =>
            commit.changes.map((c) => c.renamed === true),
          ),
          [[false], [true], [false], [true], [false], [false, false]],
        );
      }),
  );
});

/** The path and life of every change, newest commit first. */
const lives = (commits: ReadonlyArray<HistoryCommit>) =>
  commits.map((commit) =>
    commit.changes.map(({ path, previousLife }) => [
      path,
      previousLife === true ? "previous" : "current",
    ]),
  );

layer(NodeServices.layer)("readHistory lives of a path", (it) => {
  it.effect(
    "puts the deletion and every older change of a recreated path into its previous life",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": tenLines });
        yield* repo.commit("2026-03-02T12:00:00Z", {
          "a.ts": `${tenLines}two\n`,
        });
        yield* repo.git("rm", "a.ts");
        yield* repo.commit("2026-03-03T12:00:00Z");
        yield* repo.commit("2026-03-04T12:00:00Z", { "a.ts": "new\n" });
        yield* repo.commit("2026-03-05T12:00:00Z", { "a.ts": "new\nmore\n" });

        assert.deepStrictEqual(lives(yield* history(repo)), [
          [["a.ts", "current"]],
          [["a.ts", "current"]],
          [["a.ts", "previous"]],
          [["a.ts", "previous"]],
          [["a.ts", "previous"]],
        ]);
      }),
  );
});

layer(NodeServices.layer)("readHistory lives of a path and renames", (it) => {
  it.effect("keeps a renamed file's whole history in its one life", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* commitRenamedTwice(repo);

      const commits = yield* history(repo);

      assert.isTrue(
        commits.every((commit) =>
          commit.changes.every(
            ({ previousLife }) => previousLife === undefined,
          ),
        ),
      );
    }),
  );

  it.effect(
    "starts the life of a path at the file renamed onto it after a deletion",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": tenLines });
        yield* repo.git("rm", "a.ts");
        yield* repo.commit("2026-03-02T12:00:00Z");
        yield* repo.commit("2026-03-03T12:00:00Z", { "b.ts": tenLines });
        yield* repo.git("mv", "b.ts", "a.ts");
        yield* repo.commit("2026-03-04T12:00:00Z");

        assert.deepStrictEqual(lives(yield* history(repo)), [
          [["a.ts", "current"]],
          [["a.ts", "current"]],
          [["a.ts", "previous"]],
          [["a.ts", "previous"]],
        ]);
      }),
  );

  it.effect("treats deleting and adding a path in one commit as an edit", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": tenLines });
      yield* repo.git("rm", "a.ts");
      yield* repo.commit("2026-03-02T12:00:00Z", { "a.ts": "replaced\n" });

      assert.deepStrictEqual(lives(yield* history(repo)), [
        [["a.ts", "current"]],
        [["a.ts", "current"]],
      ]);
    }),
  );
});

layer(NodeServices.layer)(
  "readHistory lives of a path by the name it had",
  (it) => {
    it.effect(
      "keeps the creator of a file renamed onto the path of a file deleted earlier",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          yield* repo.commit("2026-03-01T12:00:00Z", { "b.ts": tenLines });
          yield* repo.commit("2026-03-02T12:00:00Z", { "a.ts": "other\n" });
          yield* repo.git("rm", "a.ts");
          yield* repo.commit("2026-03-03T12:00:00Z");
          yield* repo.git("mv", "b.ts", "a.ts");
          yield* repo.commit("2026-03-04T12:00:00Z");

          assert.deepStrictEqual(lives(yield* history(repo)), [
            [["a.ts", "current"]],
            [["a.ts", "previous"]],
            [["a.ts", "previous"]],
            [["a.ts", "current"]],
          ]);
        }),
    );

    it.effect(
      "puts a renamed file's history into the previous life when it was deleted under its new name",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          yield* repo.commit("2026-03-01T12:00:00Z", { "q.ts": tenLines });
          yield* repo.git("mv", "q.ts", "p.ts");
          yield* repo.commit("2026-03-02T12:00:00Z");
          yield* repo.git("rm", "p.ts");
          yield* repo.commit("2026-03-03T12:00:00Z");
          yield* repo.commit("2026-03-04T12:00:00Z", { "p.ts": "new\n" });

          assert.deepStrictEqual(lives(yield* history(repo)), [
            [["p.ts", "current"]],
            [["p.ts", "previous"]],
            [["p.ts", "previous"]],
            [["p.ts", "previous"]],
          ]);
        }),
    );

    it.effect(
      "keeps a recreated file's life when it is renamed after the recreation",
      () =>
        Effect.gen(function* () {
          const repo = yield* makeTempRepository;
          yield* repo.commit("2026-03-01T12:00:00Z", { "p.ts": "old\n" });
          yield* repo.git("rm", "p.ts");
          yield* repo.commit("2026-03-02T12:00:00Z");
          yield* repo.commit("2026-03-03T12:00:00Z", { "p.ts": tenLines });
          yield* repo.git("mv", "p.ts", "r.ts");
          yield* repo.commit("2026-03-04T12:00:00Z");

          assert.deepStrictEqual(lives(yield* history(repo)), [
            [["r.ts", "current"]],
            [["r.ts", "current"]],
            [["r.ts", "previous"]],
            [["r.ts", "previous"]],
          ]);
        }),
    );
  },
);

layer(NodeServices.layer)("readHistory people", (it) => {
  it.effect(
    "reports a mailmap-merged author under the canonical identity",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-03-01T12:00:00Z", {
          ".mailmap": "Ada Lovelace <ada@example.com> <ada@old.example>\n",
        });
        yield* repo.commit(
          "2026-03-02T12:00:00Z",
          { "a.ts": "a\n" },
          { author: { name: "ada", email: "ada@old.example" } },
        );

        const commits = yield* history(repo);

        assert.deepStrictEqual(
          commits.map((commit) => commit.author),
          [
            { name: "Ada Lovelace", email: "ada@example.com" },
            { name: "Codesaga Test", email: "test@codesaga.invalid" },
          ],
        );
      }),
  );
});

layer(NodeServices.layer)("readHistory messages and dates", (it) => {
  it.effect("keeps the UTC offset of the author date", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T23:30:00+05:30", { "a.ts": "a\n" });

      const [commit] = yield* history(repo);

      assert.strictEqual(commit?.offsetMinutes, 330);
      assert.strictEqual(commit?.time, Date.UTC(2026, 2, 1, 18, 0, 0) / 1000);
    }),
  );

  it.effect(
    "reads the committer, trailers and marker lines of the message",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        const message =
          "Add a\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\n" +
          "Co-Authored-By: Claude <noreply@anthropic.com>\nMade-with: Cursor\n";
        yield* repo.commit(
          "2026-03-01T12:00:00Z",
          { "a.ts": "a\n" },
          {
            author: { name: "Ada", email: "ada@example.com" },
            committer: { name: "Ada (aider)", email: "ada@example.com" },
            message,
          },
        );

        const [commit] = yield* history(repo);

        assert.deepStrictEqual(commit?.committer, {
          name: "Ada (aider)",
          email: "ada@example.com",
        });
        assert.deepStrictEqual(commit?.trailers, [
          { key: "Co-Authored-By", value: "Claude <noreply@anthropic.com>" },
          { key: "Made-with", value: "Cursor" },
        ]);
        assert.deepStrictEqual(commit?.markers, [
          "🤖 Generated with [Claude Code](https://claude.com/claude-code)",
        ]);
      }),
  );
});

layer(NodeServices.layer)("readHistory squash-merge bodies", (it) => {
  it.effect(
    "keeps an indented co-author line of a squash body as a marker",
    () =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* repo.commit(
          "2026-03-01T12:00:00Z",
          { "a.ts": "a\n" },
          {
            message:
              "Squash (#1)\n\n* add a\n\n  Co-Authored-By: Claude <noreply@anthropic.com>\n\n* more text\n",
          },
        );

        const [commit] = yield* history(repo);

        assert.deepStrictEqual(commit?.trailers, []);
        assert.deepStrictEqual(commit?.markers, [
          "Co-Authored-By: Claude <noreply@anthropic.com>",
        ]);
      }),
  );
});
