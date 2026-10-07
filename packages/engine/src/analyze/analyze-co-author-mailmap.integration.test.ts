import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { analyzeServices } from "../testing/oxc-parser.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const ada = { name: "Ada Lovelace", email: "ada@example.com" };
const linus = { name: "Linus", email: "linus@example.com" };

/** Both people have one address that `.mailmap` joins to their main one. */
const MAILMAP = [
  "Ada Lovelace <ada@example.com> <ada@old.example>",
  "Grace Hopper <grace@example.com> <12+grace@users.noreply.github.com>",
  "",
].join("\n");

/** Ada co-authors with her own old address; Linus with Grace's noreply address. */
const commitPairs = (repo: TempRepository) =>
  Effect.gen(function* () {
    yield* repo.commit("2026-02-01T09:00:00Z", { ".mailmap": MAILMAP });
    for (let day = 2; day < 7; day += 1) {
      const date = `2026-02-0${day}T09:00:00Z`;
      yield* repo.commit(
        date,
        { "a.ts": `${day}\n` },
        {
          author: ada,
          message: `alias\n\nCo-authored-by: Ada <ada@old.example>`,
        },
      );
      yield* repo.commit(
        date,
        { "b.ts": `${day}\n` },
        {
          author: linus,
          message: `pair\n\nCo-authored-by: Grace <12+grace@users.noreply.github.com>`,
        },
      );
    }
  });

layer(analyzeServices)("analyze co-authors through the mailmap", (it) => {
  it.effect(
    "does not count an author's own alias as a partner, and counts another person's alias",
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));
        const repo = yield* makeTempRepository;
        yield* commitPairs(repo);

        const { contributors } = yield* analyze(analyzeOptionsFor(repo));

        const pairPartners = contributors
          .filter(({ badges }) =>
            badges.some(({ kind }) => kind === "pair-partner"),
          )
          .map(({ email }) => email);
        assert.deepStrictEqual(pairPartners, [linus.email]);
      }),
    30_000,
  );
});
