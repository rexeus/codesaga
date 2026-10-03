import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { analyzeServices } from "../testing/oxc-parser.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const setNow = TestClock.setTime(Date.parse("2026-03-20T00:00:00Z"));

const anys = (count: number) =>
  Array.from(
    { length: count },
    (_, index) => `export const v${index}: any = 1;\n`,
  ).join("");

/** A file of 40 `any` that eight commits tighten by 3 each, and a person who did nothing else. */
const commitTightening = Effect.gen(function* () {
  yield* setNow;
  const repo = yield* makeTempRepository;
  yield* repo.commit("2026-01-10T09:00:00Z", { "src/a.ts": anys(40) });
  for (let step = 1; step <= 8; step += 1) {
    yield* repo.commit(`2026-02-${String(step).padStart(2, "0")}T09:00:00Z`, {
      "src/a.ts": anys(40 - step * 3),
    });
  }
  return repo;
});

layer(analyzeServices)("analyze craft badges", (it) => {
  it.effect("awards type-tightener to the person who removed the any", () =>
    Effect.gen(function* () {
      const repo = yield* commitTightening;

      const { contributors } = yield* analyze(analyzeOptionsFor(repo));

      const badges = contributors.flatMap((person) => person.badges);
      assert.deepStrictEqual(
        badges
          .filter(({ category }) => category === "craft")
          .map(({ kind, evidence }) => [kind, evidence]),
        [
          [
            "type-tightener",
            "Removed 24 explicit any in the last 365 days, in 8 commits that each removed some.",
          ],
        ],
      );
    }),
  );

  it.effect(
    "withholds the code craft badges when the history was not parsed",
    () =>
      Effect.gen(function* () {
        const repo = yield* commitTightening;

        const { contributors } = yield* analyze(
          analyzeOptionsFor(repo, { typescriptHistory: false }),
        );

        assert.isFalse(
          contributors
            .flatMap(({ badges }) => badges)
            .some(({ kind }) => kind === "type-tightener"),
        );
      }),
  );
});
