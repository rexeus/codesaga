import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";

import { Git } from "../git/git.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { readHistory } from "./history.js";

// Ten distinct lines keep a file similar enough for git to detect a rename
// after one appended line.
const tenLines = Array.from(
  { length: 10 },
  (_, index) => `line ${index}\n`,
).join("");

const history = (
  repo: TempRepository,
  skipCommits: ReadonlySet<string> = new Set(),
) =>
  readHistory({ skipCommits }).pipe(Effect.provide(Git.layer(repo.directory)));

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
