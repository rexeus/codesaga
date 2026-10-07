import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { analyzeServices } from "../testing/oxc-parser.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import { analyze } from "./analyze.js";

const ada = { name: "Ada Lovelace", email: "ada@example.com" };
const abbot = { name: "Abbot", email: "abbot@example.com" };
const effectBot = {
  name: "effect-bot",
  email: "2320433+effect-bot@users.noreply.github.com",
};

layer(analyzeServices)("analyze bot accounts without [bot]", (it) => {
  it.effect(
    "keeps an account named like a bot out of the contributors and lists it under bots",
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));
        const repo = yield* makeTempRepository;
        yield* repo.commit(
          "2026-02-01T09:00:00Z",
          { "a.ts": "1\n" },
          { author: ada },
        );
        yield* repo.commit(
          "2026-02-02T09:00:00Z",
          { "a.ts": "2\n" },
          { author: effectBot },
        );
        yield* repo.commit(
          "2026-02-03T09:00:00Z",
          { "b.ts": "1\n" },
          { author: abbot },
        );

        const report = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(
          report.contributors.map(({ name }) => name).toSorted(),
          ["Abbot", "Ada Lovelace"],
        );
        assert.deepStrictEqual(report.automation.tools, [
          { name: "effect-bot", kind: "bot", authored: 1, assisted: 0 },
        ]);
      }),
  );
});

layer(analyzeServices)("analyze people with a bot-like login", (it) => {
  it.effect(
    "makes a person with a bot-like login a contributor again through .mailmap",
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));
        const repo = yield* makeTempRepository;
        const janeBot = {
          name: "jane-bot",
          email: "1234+jane-bot@users.noreply.github.com",
        };
        yield* repo.commit(
          "2026-02-01T09:00:00Z",
          {
            "a.ts": "1\n",
            ".mailmap":
              "Jane <jane@real.io> <1234+jane-bot@users.noreply.github.com>\n",
          },
          { author: ada },
        );
        yield* repo.commit(
          "2026-02-02T09:00:00Z",
          { "a.ts": "2\n" },
          { author: janeBot },
        );

        const report = yield* analyze(analyzeOptionsFor(repo));

        assert.deepStrictEqual(
          report.contributors
            .map(({ name, email }) => `${name} <${email}>`)
            .toSorted(),
          ["Ada Lovelace <ada@example.com>", "Jane <jane@real.io>"],
        );
        assert.deepStrictEqual(report.automation.tools, []);
      }),
  );
});
