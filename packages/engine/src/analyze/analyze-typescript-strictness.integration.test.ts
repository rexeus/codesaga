import { assert, layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { analyzeServices } from "../testing/oxc-parser.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));

const files = (directory: string): Record<string, string> =>
  Object.fromEntries(
    ["x", "y", "z"].map((name) => [
      `${directory}/src/${name}.ts`,
      `export const ${name} = 1;\n`,
    ]),
  );

const monorepo = Effect.gen(function* () {
  yield* setNow;
  const repo = yield* makeTempRepository;
  yield* repo.commit("2026-02-01T09:00:00Z", {
    "package.json": '{ "devDependencies": { "typescript": "^5.9.2" } }\n',
    "tsconfig.base.json": `{
      // shared by every package
      "compilerOptions": { "strict": true, "target": "ES2022", },
    }\n`,
    "packages/a/package.json": "{}\n",
    "packages/a/tsconfig.json": `{
      "extends": "../../tsconfig.base",
      "compilerOptions": { "noUncheckedIndexedAccess": true },
      "include": ["src"]
    }\n`,
    "packages/b/package.json": "{}\n",
    "packages/b/tsconfig.json": `{
      "extends": "@tsconfig/strictest/tsconfig.json",
      "include": ["src"]
    }\n`,
    "packages/c/package.json": "{}\n",
    ...files("packages/a"),
    ...files("packages/b"),
    ...files("packages/c"),
  });
  return repo;
});

const strictnessOf = (repo: Parameters<typeof analyzeOptionsFor>[0]) =>
  analyze(analyzeOptionsFor(repo)).pipe(
    Effect.map(({ deepDives }) => deepDives?.typescript?.strictness),
  );

layer(analyzeServices)("analyze the TypeScript strictness", (it) => {
  it.effect(
    "reports the effective flags of a package that extends a base",
    () =>
      Effect.gen(function* () {
        const strictness = yield* strictnessOf(yield* monorepo);

        assert.deepStrictEqual(strictness?.typescript, {
          declared: "^5.9.2",
          strictByDefault: false,
        });
        assert.deepStrictEqual(
          strictness?.configs.find(
            ({ path }) => path === "packages/a/tsconfig.json",
          ),
          {
            path: "packages/a/tsconfig.json",
            extends: ["tsconfig.base.json"],
            unresolved: [],
            files: 3,
            strict: true,
            strictExceptions: [],
            noUncheckedIndexedAccess: true,
            exactOptionalPropertyTypes: false,
            noImplicitOverride: false,
            verbatimModuleSyntax: false,
            isolatedModules: false,
            allowJs: false,
            checkJs: false,
            target: "ES2022",
            module: null,
            moduleResolution: null,
          },
        );
      }),
  );
});

layer(analyzeServices)("analyze the strictness of presets", (it) => {
  it.effect(
    "marks an uninstalled preset unresolved and its options unknown",
    () =>
      Effect.gen(function* () {
        const strictness = yield* strictnessOf(yield* monorepo);

        const configB = strictness?.configs.find(
          ({ path }) => path === "packages/b/tsconfig.json",
        );
        assert.deepStrictEqual(
          [
            configB?.unresolved,
            configB?.strict,
            configB?.noUncheckedIndexedAccess,
          ],
          [["@tsconfig/strictest/tsconfig.json"], "unknown", "unknown"],
        );
        assert.deepStrictEqual(
          [
            strictness?.totalConfigs,
            strictness?.governedFiles,
            strictness?.ungovernedFiles,
          ],
          [3, 6, 3],
        );
      }),
  );
});

layer(analyzeServices)("analyze the strictness of territories", (it) => {
  it.effect(
    "gives each territory the strict of the configs that govern its files",
    () =>
      Effect.gen(function* () {
        const repo = yield* monorepo;

        const report = yield* analyze(analyzeOptionsFor(repo));

        const strictOf = Object.fromEntries(
          report.knowledge.territories.territories.map((territory) => [
            territory.path,
            territory.typescript?.strict,
          ]),
        );
        assert.deepStrictEqual(strictOf, {
          "packages/a": true,
          "packages/b": "unknown",
          "packages/c": undefined,
        });
      }),
  );

  it.effect("resolves an installed preset from node_modules", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repo = yield* monorepo;
      const preset = path.join(
        repo.directory,
        "node_modules/@tsconfig/strictest/tsconfig.json",
      );
      yield* fs.makeDirectory(path.dirname(preset), { recursive: true });
      yield* fs.writeFileString(
        preset,
        '{ "compilerOptions": { "strict": true, "exactOptionalPropertyTypes": true } }',
      );

      const { deepDives } = yield* analyze(analyzeOptionsFor(repo));

      const configB = deepDives?.typescript?.strictness?.configs.find(
        ({ path: configPath }) => configPath === "packages/b/tsconfig.json",
      );
      assert.deepStrictEqual(
        [
          configB?.extends,
          configB?.unresolved,
          configB?.strict,
          configB?.exactOptionalPropertyTypes,
        ],
        [["node_modules/@tsconfig/strictest/tsconfig.json"], [], true, true],
      );
    }),
  );
});

layer(analyzeServices)("analyze the strictness of other repositories", (it) => {
  it.effect("says there is no config in a JavaScript-only repository", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-02-01T09:00:00Z", {
        "index.js": "export const a = 1;\n",
      });

      const { deepDives } = yield* analyze(analyzeOptionsFor(repo));

      assert.deepStrictEqual(deepDives?.typescript?.strictness, {
        typescript: { declared: null, strictByDefault: "unknown" },
        configs: [],
        totalConfigs: 0,
        governedFiles: 0,
        ungovernedFiles: 0,
        jsFilesOutsideConfigs: 1,
      });
    }),
  );

  it.effect("stops at a config that extends itself", () =>
    Effect.gen(function* () {
      yield* setNow;
      const repo = yield* makeTempRepository;
      yield* repo.commit("2026-02-01T09:00:00Z", {
        "tsconfig.json": '{ "extends": "./tsconfig.json" }\n',
        "src/a.ts": "export const a = 1;\n",
      });

      const { deepDives } = yield* analyze(analyzeOptionsFor(repo));

      assert.deepStrictEqual(
        deepDives?.typescript?.strictness?.configs.map(
          ({ unresolved, strict }) => [unresolved, strict],
        ),
        [[["./tsconfig.json"], "unknown"]],
      );
    }),
  );
});
