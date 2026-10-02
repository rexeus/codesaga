import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { analyzeServices } from "../testing/oxc-parser.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));

const declaring = (dependency: string): string =>
  JSON.stringify({ dependencies: { [dependency]: "^1" } });

layer(analyzeServices)(
  "analyze the project's own manifests and configs",
  (it) => {
    it.effect(
      "ignores vendored, generated, build-output and sample manifests and configs",
      () =>
        Effect.gen(function* () {
          yield* setNow;
          const repo = yield* makeTempRepository;
          yield* repo.commit("2026-02-01T09:00:00Z", {
            ".gitattributes":
              "third_party/** linguist-vendored\ngen/** linguist-generated\n",
            "package.json": declaring("zod"),
            "tsconfig.json": '{ "compilerOptions": { "strict": true } }',
            "third_party/lib/package.json": declaring("react"),
            "third_party/lib/tsconfig.json": "{}",
            "gen/package.json": declaring("vue"),
            "vendor/x/package.json": declaring("svelte"),
            "examples/next-app/package.json": declaring("next"),
            "examples/next-app/tsconfig.json": "{}",
            "templates/starter/package.json": declaring("solid-js"),
            "fixtures/app/package.json": declaring("koa"),
            "src/a.ts": "export const a = 1;\n",
          });

          const { deepDives } = yield* analyze(analyzeOptionsFor(repo));

          const typescript = deepDives?.typescript;
          assert.deepStrictEqual(
            typescript?.ecosystem?.tools.map(({ name }) => name),
            ["zod"],
          );
          assert.deepStrictEqual(typescript?.ecosystem?.dependencies, {
            manifests: 1,
            runtime: 1,
            dev: 0,
          });
          assert.deepStrictEqual(
            typescript?.strictness?.configs.map(({ path }) => path),
            ["tsconfig.json"],
          );
        }),
    );
  },
);
