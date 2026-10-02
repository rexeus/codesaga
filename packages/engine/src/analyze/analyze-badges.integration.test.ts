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

const DAY = 86_400_000;
const FIRST_MONDAY = Date.parse("2025-09-01T00:00:00Z");

/** The ISO date of the `week`-th Monday after 2025-09-01, with the author's `time` and UTC `offset`. */
const mondayAt = (week: number, time: string, offset: string): string =>
  `${new Date(FIRST_MONDAY + week * 7 * DAY).toISOString().slice(0, 10)}T${time}${offset}`;

/**
 * Ada commits on 40 Mondays at 23:30 in Berlin's summer time, six of them with
 * Grace as co-author; three more commits are assisted by agents, one of them
 * with Grace too. Grace commits once at noon UTC.
 */
const commitNightShifts = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit(
      "2025-08-25T12:00:00Z",
      { "src/a.ts": "start\n" },
      { author: grace },
    );
    for (let week = 0; week < 40; week += 1) {
      const trailer =
        week % 7 === 0 ? "\n\nCo-authored-by: Grace <grace@example.com>" : "";
      yield* repo.commit(
        mondayAt(week, "23:30:00", "+02:00"),
        { "src/a.ts": `${week}\n` },
        { author: ada, message: `work ${week}${trailer}` },
      );
    }
    for (const trailer of [
      "Claude <noreply@anthropic.com>",
      "Copilot <198982749+Copilot@users.noreply.github.com>",
      "Claude <noreply@anthropic.com>\nCo-authored-by: Grace <grace@example.com>",
    ]) {
      yield* repo.commit(
        "2026-06-10T12:00:00+02:00",
        { "src/b.ts": `${trailer}\n` },
        { author: ada, message: `assisted\n\nCo-authored-by: ${trailer}` },
      );
    }
  });

layer(NodeServices.layer)("analyze contributor badges", (it) => {
  it.effect(
    "awards night owl and pair partner from the dates, offsets and trailers of a real history",
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(Date.parse("2026-07-01T00:00:00Z"));
        const repo = yield* makeTempRepository;
        yield* commitNightShifts(repo);

        const { contributors } = yield* analyze(analyzeOptionsFor(repo));

        const badges =
          contributors.find(({ email }) => email === ada.email)?.badges ?? [];
        assert.deepStrictEqual(
          badges
            .filter(({ category }) => category !== "journey")
            .map(({ kind, category, evidence }) => ({
              kind,
              category,
              evidence,
            })),
          [
            {
              kind: "night-owl",
              category: "rhythm",
              evidence:
                "Often commits late: 100% of their commits in the last year between 22:00 and 05:00 (40 of 40).",
            },
            {
              kind: "pair-partner",
              category: "collaboration",
              evidence:
                "7 commits in the last year with another person as co-author.",
            },
          ],
        );
        assert.deepStrictEqual(
          contributors
            .find(({ email }) => email === grace.email)
            ?.badges.filter(({ category }) => category !== "journey"),
          [],
        );
      }),
    30_000,
  );
});
