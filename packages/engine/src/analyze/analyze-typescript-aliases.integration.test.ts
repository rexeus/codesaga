import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { analyzeServices } from "../testing/oxc-parser.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));

const IMPORT_UTIL = 'import { util } from "@/util";\nexport const x = util;\n';

layer(analyzeServices)(
  "analyze imports in files no tsconfig includes",
  (it) => {
    it.effect(
      "resolves a paths alias for a script, a test and an excluded file by the config above them, and never calls an alias that finds nothing external",
      () =>
        Effect.gen(function* () {
          yield* setNow;
          const repo = yield* makeTempRepository;
          yield* repo.commit("2026-02-01T09:00:00Z", {
            "tsconfig.json": `{
            "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"] } },
            "include": ["src"],
            "exclude": ["src/excluded"]
          }\n`,
            "src/util.ts": "export const util = 1;\n",
            "src/a.ts": IMPORT_UTIL,
            "src/excluded/x.ts": IMPORT_UTIL,
            "scripts/build.ts": `${IMPORT_UTIL}import "@/missing";\n`,
            "test/a.test.ts": IMPORT_UTIL,
          });

          const { deepDives } = yield* analyze(analyzeOptionsFor(repo));

          const files = deepDives?.typescript?.imports?.files;
          assert.deepStrictEqual(files?.fanIn.top, [
            { path: "src/util.ts", count: 3 },
          ]);
          assert.strictEqual(files?.edges.tests, 1);
          assert.strictEqual(files?.external, 0);
          assert.deepStrictEqual(files?.unresolved.top, [
            { specifier: "@/missing", files: 1 },
          ]);
        }),
    );
  },
);
