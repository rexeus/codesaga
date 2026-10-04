import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem } from "effect";
import { TestClock } from "effect/testing";

import { GitNotFound, NotAGitRepository } from "../git/git-errors.js";
import { Git } from "../git/git.js";
import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { fieldsOf } from "../testing/error-fields.js";
import { analyzeServices } from "../testing/oxc-parser.js";
import { setScopedEnv } from "../testing/scoped-env.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { InvalidSince } from "./analysis-window.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));

layer(analyzeServices)("analyze repository states", (it) => {
  it.effect(
    "reports a null head and no commits for a repository without commits",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;

        const report = yield* analyze(analyzeOptionsFor(repo));

        assert.isNull(report.repository.head);
        assert.isNull(report.repository.firstCommitAt);
        assert.strictEqual(report.window.commits, 0);
        assert.deepStrictEqual(report.contributors, []);
        assert.deepStrictEqual(report.automation.tools, []);
      }),
  );

  it.effect("reports the branch, or null when HEAD is detached", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", { "a.ts": "a\n" });
      yield* repo.git("checkout", "--quiet", "-b", "release/1");
      const onBranch = yield* analyze(analyzeOptionsFor(repo));
      yield* repo.git("checkout", "--quiet", "--detach");

      const detached = yield* analyze(analyzeOptionsFor(repo));

      assert.strictEqual(onBranch.repository.branch, "release/1");
      assert.isNull(detached.repository.branch);
    }),
  );
});

layer(analyzeServices)("analyze shallow clones and includes", (it) => {
  it.effect("marks a shallow clone and leaves out its boundary commit", () =>
    Effect.gen(function* () {
      yield* setNow;
      const fs = yield* FileSystem.FileSystem;
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", {
        "a.ts": "1\n",
        "b.ts": "1\n",
      });
      yield* repo.commit("2026-03-02T12:00:00Z", { "a.ts": "2\n" });
      yield* repo.commit("2026-03-03T12:00:00Z", { "a.ts": "3\n" });
      const clone = `${yield* fs.makeTempDirectoryScoped()}/clone`;
      yield* repo.git(
        "clone",
        "--quiet",
        "--depth",
        "2",
        `file://${repo.directory}`,
        clone,
      );

      const complete = yield* analyze(analyzeOptionsFor(repo));
      const shallow = yield* analyze(analyzeOptionsFor({ directory: clone }));

      assert.strictEqual(complete.repository.shallow, false);
      assert.strictEqual(complete.window.commits, 3);
      assert.strictEqual(shallow.repository.shallow, true);
      assert.strictEqual(shallow.window.commits, 1);
    }),
  );

  it.effect("names a file that only --include admits Other", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-03-01T12:00:00Z", {
        "notes.custom": "x\ny\n",
        "a.ts": "a\n",
      });

      const report = yield* analyze(
        analyzeOptionsFor(repo, { include: ["**/*.custom", "**/*.ts"] }),
      );

      assert.deepStrictEqual(report.overview.languages, [
        { name: "Other", files: 1, loc: 2 },
        { name: "TypeScript", files: 1, loc: 1 },
      ]);
    }),
  );
});

layer(analyzeServices)("analyze failures", (it) => {
  it.effect("fails with NotAGitRepository outside a git work tree", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* fs.makeTempDirectoryScoped();

      const failure = yield* Effect.flip(
        analyze(analyzeOptionsFor({ directory })),
      );

      assert.deepStrictEqual(
        fieldsOf(failure),
        fieldsOf(new NotAGitRepository({ path: directory })),
      );
    }),
  );

  it.effect("fails with GitNotFound when git is not on PATH", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;
      yield* setScopedEnv({ PATH: "" });

      const failure = yield* Effect.flip(analyze(analyzeOptionsFor(repo)));

      assert.deepStrictEqual(fieldsOf(failure), fieldsOf(new GitNotFound()));
    }),
  );

  it.effect("fails with InvalidSince for an unparseable since value", () =>
    Effect.gen(function* () {
      const repo = yield* makeTempRepository;

      const failure = yield* Effect.flip(
        analyze(analyzeOptionsFor(repo, { since: "last week" })),
      );

      assert.deepStrictEqual(
        fieldsOf(failure),
        fieldsOf(new InvalidSince({ input: "last week" })),
      );
    }),
  );
});

/** Commits on top of HEAD with a raw author time that `git commit` refuses. */
const commitAtRawTime = (repo: TempRepository, rawDate: string) =>
  Effect.gen(function* () {
    const git = yield* Git.make(repo.directory);
    const tree = (yield* repo.git("rev-parse", "HEAD^{tree}")).trim();
    const parent = (yield* repo.git("rev-parse", "HEAD")).trim();
    const person = `Raw <raw@example.com> ${rawDate}`;
    const commit = yield* git
      .text(
        ["hash-object", "-w", "-t", "commit", "--literally", "--stdin"],
        `tree ${tree}\nparent ${parent}\nauthor ${person}\ncommitter ${person}\n\nraw\n`,
      )
      .pipe(Effect.orDie);
    yield* repo.git("update-ref", "HEAD", commit.trim());
  });

layer(analyzeServices)("analyze implausible commit times", (it) => {
  it.effect(
    "leaves commits dated before the epoch or after now out of every section",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* repo.commit("2026-01-05T09:00:00Z", { "a.ts": "a\n" });
        yield* repo.commit("2026-02-01T09:00:00Z", { "a.ts": "b\n" });
        yield* commitAtRawTime(repo, "-5000 +0000");
        yield* commitAtRawTime(repo, "4102444800 +0000");
        yield* commitAtRawTime(repo, "9999999999999 +0000");
        yield* commitAtRawTime(repo, "99999999999999999999 +0000");

        const report = yield* analyze(analyzeOptionsFor(repo));

        assert.strictEqual(
          report.repository.firstCommitAt,
          "2026-01-05T09:00:00.000Z",
        );
        assert.strictEqual(
          report.repository.lastCommitAt,
          "2026-02-01T09:00:00.000Z",
        );
        assert.deepStrictEqual(report.window, {
          since: "2026-01-05T09:00:00.000Z",
          until: "2026-03-10T00:00:00.000Z",
          commits: 2,
        });
        assert.strictEqual(report.overview.commits, 2);
        assert.deepStrictEqual(report.automation.totals, {
          human: 2,
          agentAssisted: 0,
          agent: 0,
          bot: 0,
        });
      }),
  );
});
