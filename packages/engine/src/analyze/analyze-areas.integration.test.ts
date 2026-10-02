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
  levels: ReadonlyArray<{
    areas: ReadonlyArray<{ kind: string; path: string; files: number }>;
  }>,
) =>
  levels.map(({ areas }) =>
    areas.map(({ kind, path, files }) => `${kind} ${path} ${files}`),
  );

layer(NodeServices.layer)("analyze knowledge areas", (it) => {
  const setNow = TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));

  it.effect(
    "cuts the repository at its package manifests and recommends a level",
    () =>
      Effect.gen(function* () {
        yield* setNow;
        const repo = yield* makeTempRepository;
        yield* commitTwoPackages(repo);

        const { knowledge } = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(summarize(knowledge.areas.levels), [
          [
            "package apps/web 4",
            "package packages/cli 3",
            "package packages/lib 3",
          ],
          [
            "directory apps/web/src 3",
            "package packages/cli 3",
            "package packages/lib 3",
            "rest apps 1",
          ],
        ]);
        assert.strictEqual(knowledge.areas.depth, 1);
        assert.strictEqual(
          knowledge.areas.reason,
          "level 1: 3 areas with 3+ files for 2 active contributors",
        );
      }),
  );
});

layer(NodeServices.layer)("analyze area badges", (it) => {
  it.effect(
    "awards the badges that need areas to the sole active expert of each",
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
                "welcome: Welcome",
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
          report.knowledge.areas.levels[0]?.areas.map(({ path, badges }) => [
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

layer(NodeServices.layer)("analyze knowledge areas options", (it) => {
  const setNow = TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));

  it.effect("starts at the requested depth", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* commitTwoPackages(repo);

      const { knowledge } = yield* analyze(
        analyzeOptionsFor(repo, { depth: 2 }),
      );

      assert.strictEqual(knowledge.areas.depth, 2);
      assert.strictEqual(knowledge.areas.recommendedDepth, 1);
    }),
  );

  it.effect("cuts only the packages inside the analyzed scope", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* commitTwoPackages(repo);

      const { knowledge } = yield* analyze(
        analyzeOptionsFor(repo, { scope: "packages" }),
      );

      assert.deepStrictEqual(summarize(knowledge.areas.levels), [
        ["package packages/cli 3", "package packages/lib 3"],
      ]);
    }),
  );

  it.effect("treats the scoped package itself as one area", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* commitTwoPackages(repo);

      const { knowledge } = yield* analyze(
        analyzeOptionsFor(repo, { scope: "packages/lib" }),
      );

      assert.deepStrictEqual(summarize(knowledge.areas.levels), [
        ["package packages/lib 3"],
      ]);
    }),
  );

  it.effect("shows a scoped file as one directory area of that file", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* commitTwoPackages(repo);

      const { knowledge } = yield* analyze(
        analyzeOptionsFor(repo, { scope: "packages/lib/x.ts" }),
      );

      assert.deepStrictEqual(summarize(knowledge.areas.levels), [
        ["directory packages/lib/x.ts 1"],
      ]);
      assert.strictEqual(
        knowledge.areas.reason,
        "level 1: 1 area with 3+ files for 1 active contributor",
      );
    }),
  );
});
