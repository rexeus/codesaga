import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const ada = { name: "Ada Lovelace", email: "ada@example.com" };
const grace = { name: "Grace", email: "grace@example.com" };

const code = (directory: string, names: ReadonlyArray<string>) =>
  Object.fromEntries(
    names.map((name) => [`${directory}/${name}.ts`, `${name}\n`]),
  );

/** Ada writes apps/web; Grace writes packages/lib and packages/cli. Each package has a manifest. */
const commitTwoPackages = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit(
      "2026-02-01T09:00:00Z",
      {
        "package.json": "{}\n",
        "apps/web/package.json": "{}\n",
        "apps/web/index.ts": "index\n",
        ...code("apps/web/src", ["a", "b", "c"]),
      },
      { author: ada },
    );
    yield* repo.commit(
      "2026-02-02T09:00:00Z",
      {
        "packages/lib/package.json": "{}\n",
        ...code("packages/lib", ["x", "y", "z"]),
        "packages/cli/package.json": "{}\n",
        ...code("packages/cli", ["m", "n", "o"]),
      },
      { author: grace },
    );
  });

const summarize = (
  territories: ReadonlyArray<{ kind: string; path: string; files: number }>,
) => territories.map(({ kind, path, files }) => `${kind} ${path} ${files}`);

/** Commits of `commitTwoPackages` plus Grace's tests for apps/web: the package holds 7 of 13 files and its folders have different experts. */
const commitSplitPackage = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* commitTwoPackages(repo);
    yield* repo.commit(
      "2026-02-03T09:00:00Z",
      code("apps/web/test", ["t1", "t2", "t3"]),
      { author: grace },
    );
  });

/** `commitSplitPackage` plus Ada's package packages/api of 5 files: apps/web holds 7 of 18 files, less than 40%. */
const commitSplitPackageAmongOthers = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* commitSplitPackage(repo);
    yield* repo.commit(
      "2026-02-04T09:00:00Z",
      {
        "packages/api/package.json": "{}\n",
        ...code("packages/api", ["a", "b", "c", "d", "e"]),
      },
      { author: ada },
    );
  });

layer(NodeServices.layer)("analyze knowledge territories", (it) => {
  const setNow = TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));

  it.effect(
    "cuts the repository at its package manifests and recommends a detail",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* commitTwoPackages(repo);

        const { knowledge } = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(summarize(knowledge.territories.territories), [
          "package apps/web 4",
          "package packages/cli 3",
          "package packages/lib 3",
        ]);
        assert.strictEqual(knowledge.territories.maxDetail, 1);
        assert.strictEqual(knowledge.territories.detail, 1);
        assert.strictEqual(
          knowledge.territories.reason,
          "detail 1: 3 territories with 3+ files for 2 active contributors",
        );
      }),
  );
});

layer(NodeServices.layer)("analyze territory dates", (it) => {
  const setNow = TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));

  it.effect(
    "dates each territory by its newest commit, a bot's included, with a renamed file under its new path",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* commitTwoPackages(repo);
        yield* repo.commit(
          "2026-02-10T09:00:00Z",
          { "packages/cli/p.ts": "p\n" },
          { author: grace },
        );
        yield* repo.commit(
          "2026-02-20T09:00:00Z",
          { "packages/lib/x.ts": "x changed\n" },
          { author: { name: "dependabot[bot]", email: "bot@example.com" } },
        );
        yield* repo.git("mv", "packages/cli/m.ts", "packages/lib/m.ts");
        yield* repo.commit("2026-02-25T09:00:00Z");

        const { knowledge } = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(
          Object.fromEntries(
            knowledge.territories.territories.map(({ path, lastChangedAt }) => [
              path,
              lastChangedAt,
            ]),
          ),
          {
            "apps/web": "2026-02-01T09:00:00.000Z",
            "packages/cli": "2026-02-10T09:00:00.000Z",
            "packages/lib": "2026-02-25T09:00:00.000Z",
          },
        );
      }),
  );
});

layer(NodeServices.layer)("analyze territory badges", (it) => {
  it.effect(
    "awards the badges that need territories to the sole active expert of each",
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));
        const repo = yield* makeTempRepository;
        yield* commitTwoPackages(repo);

        const report = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(
          report.contributors.map(({ name, badges }) => [
            name,
            badges.map(({ kind, label }) => `${kind}: ${label}`),
          ]),
          [
            [
              "Ada Lovelace",
              ["founder: Founder", "keeper: Keeper of apps/web"],
            ],
            [
              "Grace",
              [
                "founder: Founder",
                "keeper: Keeper of packages/cli",
                "new-here: New here",
              ],
            ],
          ],
        );
        assert.deepStrictEqual(
          report.contributors.map(({ name, status }) => [name, status]),
          [
            ["Ada Lovelace", "active"],
            ["Grace", "new"],
          ],
        );
        assert.deepStrictEqual(
          report.knowledge.territories.territories.map(({ path, badges }) => [
            path,
            badges.map(({ kind }) => kind),
          ]),
          [
            ["apps/web", ["island"]],
            ["packages/cli", ["island"]],
            ["packages/lib", ["island"]],
          ],
        );
      }),
  );
});

layer(NodeServices.layer)("analyze knowledge territories options", (it) => {
  const setNow = TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));

  it.effect(
    "opens a package that holds most of the files at the first detail",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* commitSplitPackage(repo);

        const { knowledge } = yield* analyze(analyzeOptionsFor(repo));

        const web = knowledge.territories.territories.find(
          ({ path }) => path === "apps/web",
        );
        assert.strictEqual(web?.files, 7);
        assert.strictEqual(web?.splitDetail, 1);
        assert.strictEqual(
          web?.splitReason,
          "apps/web/src and apps/web/test have different experts",
        );
        assert.deepStrictEqual(summarize(web?.territories ?? []), [
          "folder apps/web/src 3",
          "folder apps/web/test 3",
          "other apps/web 1",
        ]);
        assert.strictEqual(knowledge.territories.maxDetail, 1);
        assert.strictEqual(
          knowledge.territories.reason,
          "detail 1: 4 territories with 3+ files for 2 active contributors",
        );
      }),
  );

  it.effect(
    "leaves the split of a package that is not dominant for a later detail the team may not allow",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* commitSplitPackageAmongOthers(repo);

        const { knowledge } = yield* analyze(analyzeOptionsFor(repo));

        const web = knowledge.territories.territories.find(
          ({ path }) => path === "apps/web",
        );
        assert.strictEqual(web?.splitDetail, 2);
        assert.strictEqual(knowledge.territories.maxDetail, 2);
        // two contributors allow 4 territories: detail 1 has 4, detail 2 has 5
        assert.strictEqual(knowledge.territories.recommendedDetail, 1);
      }),
  );
});

layer(NodeServices.layer)("analyze knowledge territories detail", (it) => {
  const setNow = TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));

  it.effect("starts at the requested detail", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* commitSplitPackageAmongOthers(repo);

      const { knowledge } = yield* analyze(
        analyzeOptionsFor(repo, { detail: 2 }),
      );

      assert.strictEqual(knowledge.territories.detail, 2);
      assert.strictEqual(knowledge.territories.recommendedDetail, 1);
    }),
  );
});

layer(NodeServices.layer)("analyze knowledge territories scope", (it) => {
  const setNow = TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));

  it.effect("cuts only the packages inside the analyzed scope", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* commitTwoPackages(repo);

      const { knowledge } = yield* analyze(
        analyzeOptionsFor(repo, { scope: "packages" }),
      );

      assert.deepStrictEqual(summarize(knowledge.territories.territories), [
        "package packages/cli 3",
        "package packages/lib 3",
      ]);
    }),
  );

  it.effect("treats the scoped package itself as one territory", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* commitTwoPackages(repo);

      const { knowledge } = yield* analyze(
        analyzeOptionsFor(repo, { scope: "packages/lib" }),
      );

      assert.deepStrictEqual(summarize(knowledge.territories.territories), [
        "package packages/lib 3",
      ]);
    }),
  );

  it.effect("shows a scoped file as one folder territory of that file", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* commitTwoPackages(repo);

      const { knowledge } = yield* analyze(
        analyzeOptionsFor(repo, { scope: "packages/lib/x.ts" }),
      );

      assert.deepStrictEqual(summarize(knowledge.territories.territories), [
        "folder packages/lib/x.ts 1",
      ]);
      assert.strictEqual(
        knowledge.territories.reason,
        "detail 1: 1 territory with 3+ files for 1 active contributor",
      );
    }),
  );
});
