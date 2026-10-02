import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { TestClock } from "effect/testing";

import { inspect } from "../inspect/inspect.js";
import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));

const adaOld = { name: "Ada Old", email: "ADA@old.example" };
const grace = { name: "Grace", email: "grace@example.com" };
const dependabot = {
  name: "dependabot[bot]",
  email: "49699333+dependabot[bot]@users.noreply.github.com",
};

/**
 * Lines that survive at HEAD (blank lines do not count):
 *  1  Ada, under an old email that `.mailmap` maps to ada@example.com, writes
 *     a.ts (a1 a2 blank a3), b.ts (b1 b2) and c.ts (c1)
 *  2  Grace replaces a2 and adds g2 (a.ts), adds g3-g5 (b.ts) and g6 (c.ts)
 *  3  Grace indents a3, which ignoring whitespace leaves to Ada
 *  4  Dependabot adds d1 to c.ts
 * a.ts: Ada 2, Grace 2; b.ts: Ada 2, Grace 3; c.ts: Ada 1, Grace 1, Dependabot 1.
 */
const commitHistory = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit(
      "2026-01-05T09:00:00Z",
      {
        "src/a.ts": "a1\na2\n\na3\n",
        "src/b.ts": "b1\nb2\n",
        "src/c.ts": "c1\n",
        ".mailmap": "Ada Lovelace <ada@example.com> <ada@old.example>\n",
      },
      { author: adaOld },
    );
    yield* repo.commit(
      "2026-01-06T09:00:00Z",
      {
        "src/a.ts": "a1\ng1\n\na3\ng2\n",
        "src/b.ts": "b1\nb2\ng3\ng4\ng5\n",
        "src/c.ts": "c1\ng6\n",
      },
      { author: grace },
    );
    yield* repo.commit(
      "2026-01-07T09:00:00Z",
      { "src/a.ts": "a1\ng1\n\n  a3\ng2\n" },
      { author: grace },
    );
    yield* repo.commit(
      "2026-01-08T09:00:00Z",
      { "src/c.ts": "c1\ng6\nd1\n" },
      { author: dependabot },
    );
  });

const ada = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  kind: "human",
} as const;
const graceOwner = {
  name: "Grace",
  email: "grace@example.com",
  kind: "human",
} as const;
const dependabotOwner = {
  name: "dependabot[bot]",
  email: "49699333+dependabot[bot]@users.noreply.github.com",
  kind: "bot",
} as const;

// A textconv filter that exits non-zero makes `git blame` fail for the files
// the attributes route to it, while `git log` never runs it. A missing blob
// would not do: git then reports the path as absent from HEAD, the benign case.
const makeBlameFailFor = (repo: TempRepository, file: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    yield* repo.git("config", "diff.broken.textconv", "false");
    yield* fs.writeFileString(
      path.join(repo.directory, ".git", "info", "attributes"),
      `${file} diff=broken\n`,
    );
  });

layer(NodeServices.layer)("analyze --blame", (it) => {
  it.effect(
    "gives each directory the shares of the lines that exist today, by mailmapped identity",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* commitHistory(repo);

        const report = yield* analyze(analyzeOptionsFor(repo, { blame: true }));

        assert.deepStrictEqual(report.knowledge.directories[0]?.lineOwners, {
          skippedFiles: 0,
          lines: 12,
          owners: [
            { ...graceOwner, lines: 6, share: 0.5 },
            { ...ada, lines: 5, share: 0.4167 },
            { ...dependabotOwner, lines: 1, share: 0.0833 },
          ],
        });
      }),
  );

  it.effect("leaves lineOwners out without blame", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* commitHistory(repo);

      const report = yield* analyze(analyzeOptionsFor(repo));

      assert.strictEqual(report.knowledge.directories.length, 1);
      assert.notProperty(report.knowledge.directories[0] ?? {}, "lineOwners");
      for (const area of report.knowledge.areas.levels[0]?.areas ?? []) {
        assert.notProperty(area, "lineOwners");
      }
    }),
  );
});

layer(NodeServices.layer)("analyze --blame areas", (it) => {
  it.effect("gives each area the line owners of its own files", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* commitHistory(repo);
      yield* repo.commit("2026-01-09T09:00:00Z", {
        "docs/a.ts": "m1\nm2\n",
        "docs/b.ts": "m3\n",
        "docs/c.ts": "m4\n",
      });

      const report = yield* analyze(analyzeOptionsFor(repo, { blame: true }));

      assert.deepStrictEqual(
        report.knowledge.areas.levels[0]?.areas.map(({ path, lineOwners }) => [
          path,
          lineOwners?.lines,
          lineOwners?.owners.map(({ name, lines }) => [name, lines]),
        ]),
        [
          ["docs", 4, [["Codesaga Test", 4]]],
          [
            "src",
            12,
            [
              ["Grace", 6],
              ["Ada Lovelace", 5],
              ["dependabot[bot]", 1],
            ],
          ],
        ],
      );
    }),
  );
});

layer(NodeServices.layer)("analyze --blame files git cannot blame", (it) => {
  it.effect("skips a file that git cannot blame instead of failing", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* commitHistory(repo);
      // Staged only: src/e.ts is in the universe but not at HEAD.
      yield* repo.git("mv", "src/c.ts", "src/e.ts");

      const report = yield* analyze(analyzeOptionsFor(repo, { blame: true }));

      assert.deepStrictEqual(report.knowledge.directories[0]?.lineOwners, {
        skippedFiles: 0,
        lines: 9,
        owners: [
          { ...graceOwner, lines: 5, share: 0.5556 },
          { ...ada, lines: 4, share: 0.4444 },
        ],
      });
    }),
  );

  it.effect("counts a file whose blame failed for another reason", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* commitHistory(repo);
      yield* makeBlameFailFor(repo, "src/b.ts");

      const report = yield* analyze(analyzeOptionsFor(repo, { blame: true }));

      assert.deepStrictEqual(report.knowledge.directories[0]?.lineOwners, {
        skippedFiles: 1,
        lines: 7,
        owners: [
          { ...ada, lines: 3, share: 0.4286 },
          { ...graceOwner, lines: 3, share: 0.4286 },
          { ...dependabotOwner, lines: 1, share: 0.1429 },
        ],
      });
      assert.strictEqual(report.knowledge.lineOwners?.skippedFiles, 1);
    }),
  );
});

layer(NodeServices.layer)("inspect --blame", (it) => {
  it.effect("gives an entry the owners of the files it matches", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* commitHistory(repo);

      const result = yield* inspect({
        ...analyzeOptionsFor(repo, { blame: true }),
        patterns: ["src/a.ts"],
      });

      assert.deepStrictEqual(result.matches[0]?.lineOwners, {
        skippedFiles: 0,
        lines: 4,
        owners: [
          { ...ada, lines: 2, share: 0.5 },
          { ...graceOwner, lines: 2, share: 0.5 },
        ],
      });
    }),
  );
});

layer(NodeServices.layer)("inspect --blame skipped files", (it) => {
  it.effect("counts no skipped file before the first commit", () =>
    Effect.gen(function* () {
      yield* setNow;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repo = yield* makeTempRepository;
      yield* fs.makeDirectory(path.join(repo.directory, "src"));
      yield* fs.writeFileString(
        path.join(repo.directory, "src", "a.ts"),
        "a1\n",
      );
      yield* repo.git("add", "src/a.ts");

      const result = yield* inspect({
        ...analyzeOptionsFor(repo, { blame: true }),
        patterns: ["src/a.ts"],
      });

      assert.deepStrictEqual(result.matches[0]?.lineOwners, {
        skippedFiles: 0,
        lines: 0,
        owners: [],
      });
    }),
  );

  it.effect(
    "counts a failed file once for all matches together, though entries overlap",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* commitHistory(repo);
        yield* makeBlameFailFor(repo, "src/b.ts");

        const result = yield* inspect({
          ...analyzeOptionsFor(repo, { blame: true }),
          patterns: ["src/b.ts", "src"],
        });

        assert.deepStrictEqual(
          result.matches.map((entry) => entry.lineOwners?.skippedFiles),
          [1, 1],
        );
        assert.strictEqual(result.lineOwners?.skippedFiles, 1);
      }),
  );
});
