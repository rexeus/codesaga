import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { analyzeServices } from "../testing/oxc-parser.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));

const sources = (directory: string): Record<string, string> =>
  Object.fromEntries(
    ["x", "y", "z"].map((name) => [
      `${directory}/src/${name}.ts`,
      `export const ${name} = 1;\n`,
    ]),
  );

/** A workspace package `@repo/tsconfig` with presets, and an app that extends `specifier` of it. */
const workspace = (specifier: string) =>
  Effect.gen(function* () {
    yield* setNow;
    const repo = yield* makeTempRepository;
    yield* repo.commit("2026-02-01T09:00:00Z", {
      "package.json": '{ "devDependencies": { "typescript": "^5.9.0" } }',
      "packages/tsconfig/package.json": JSON.stringify({
        name: "@repo/tsconfig",
        exports: { "./node": "./configs/node.json", "./*.json": "./*.json" },
        tsconfig: "base.json",
      }),
      "packages/tsconfig/base.json":
        '{ "compilerOptions": { "strict": true } }',
      "packages/tsconfig/configs/node.json":
        '{ "compilerOptions": { "strict": true, "module": "NodeNext" } }',
      "apps/web/package.json": "{}",
      "apps/web/tsconfig.json": JSON.stringify({
        extends: specifier,
        include: ["src"],
      }),
      ...sources("apps/web"),
    });
    return repo;
  });

const webConfig = (repo: Parameters<typeof analyzeOptionsFor>[0]) =>
  analyze(analyzeOptionsFor(repo)).pipe(
    Effect.map(({ deepDives }) =>
      deepDives?.typescript?.strictness?.configs.find(
        ({ path }) => path === "apps/web/tsconfig.json",
      ),
    ),
  );

layer(analyzeServices)("analyze extends through workspace packages", (it) => {
  it.effect(
    "resolves a package subpath through the repository's own manifests, without an install",
    () =>
      Effect.gen(function* () {
        const config = yield* webConfig(
          yield* workspace("@repo/tsconfig/base.json"),
        );

        assert.deepStrictEqual(
          [config?.extends, config?.unresolved, config?.strict],
          [["packages/tsconfig/base.json"], [], true],
        );
      }),
  );

  it.effect(
    "follows exports for a mapped subpath and the tsconfig field for the package itself",
    () =>
      Effect.gen(function* () {
        const mapped = yield* webConfig(
          yield* workspace("@repo/tsconfig/node"),
        );
        const bare = yield* webConfig(yield* workspace("@repo/tsconfig"));

        assert.deepStrictEqual(mapped?.extends, [
          "packages/tsconfig/configs/node.json",
        ]);
        assert.strictEqual(mapped?.module, "NodeNext");
        assert.deepStrictEqual(bare?.extends, ["packages/tsconfig/base.json"]);
      }),
  );

  it.effect(
    "reports a node_modules symlink to a workspace package by its real path",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repo = yield* workspace("@other/preset/base.json");
        yield* fs.makeDirectory(
          path.join(repo.directory, "node_modules/@other"),
          {
            recursive: true,
          },
        );
        yield* fs.symlink(
          path.join(repo.directory, "packages/tsconfig"),
          path.join(repo.directory, "node_modules/@other/preset"),
        );

        const config = yield* webConfig(repo);

        assert.deepStrictEqual(
          [config?.extends, config?.unresolved],
          [["packages/tsconfig/base.json"], []],
        );
      }),
  );
});

layer(analyzeServices)("analyze extends beyond the repository", (it) => {
  it.effect("treats a config outside the repository as unresolved", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repo = yield* workspace("../../../outside-codesaga.json");
      const outside = path.join(
        path.dirname(repo.directory),
        "outside-codesaga.json",
      );
      yield* fs.writeFileString(
        outside,
        '{ "compilerOptions": { "strict": true } }',
      );
      yield* Effect.addFinalizer(() => Effect.ignore(fs.remove(outside)));

      const config = yield* webConfig(repo);

      assert.deepStrictEqual(
        [config?.extends, config?.unresolved, config?.strict],
        [[], ["../../../outside-codesaga.json"], "unknown"],
      );
    }),
  );
});
