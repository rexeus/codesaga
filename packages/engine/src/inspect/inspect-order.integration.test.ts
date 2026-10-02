import { assert, layer } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { analyzeOptionsFor } from "../testing/analyze-options.js";
import { servicesWithoutParser } from "../testing/no-parser.js";
import { makeTempRepository } from "../testing/temp-repository.js";
import type { TempRepository } from "../testing/temp-repository.js";
import { inspect } from "./inspect.js";

// Ten distinct lines keep a file similar enough for git to detect a rename
// after one appended line.
const tenLines = Array.from(
  { length: 10 },
  (_, index) => `line ${index}\n`,
).join("");

/** f.ts is created (A), edited (B), renamed to g.ts (C) and g.ts edited (D), dated as given. */
const commitRenameChain = (
  repo: TempRepository,
  [a, b, c, d]: readonly [string, string, string, string],
) =>
  Effect.gen(function* () {
    yield* repo.commit(a, { "f.ts": tenLines });
    yield* repo.commit(b, { "f.ts": `${tenLines}b\n` });
    yield* repo.git("mv", "f.ts", "g.ts");
    yield* repo.commit(c);
    yield* repo.commit(d, { "g.ts": `${tenLines}b\nd\n` });
  });

const commitsOfG = (repo: TempRepository, cache: boolean) =>
  Effect.gen(function* () {
    yield* TestClock.setTime(Date.parse("2026-03-10T00:00:00Z"));
    const result = yield* inspect({
      ...analyzeOptionsFor(repo, { cache }),
      patterns: ["g.ts"],
    });
    return result.matches[0]?.commits;
  });

layer(servicesWithoutParser)(
  "inspect a file renamed within one history",
  (it) => {
    it.effect.each([
      [
        "commits made in the same second",
        [
          "2024-01-01T12:00:00Z",
          "2024-01-01T12:00:00Z",
          "2024-01-01T12:00:00Z",
          "2024-01-01T12:00:00Z",
        ],
      ],
      [
        "a commit dated before its parent",
        [
          "2024-01-01T12:00:00Z",
          "2024-01-11T12:00:00Z",
          "2024-01-05T12:00:00Z",
          "2024-01-12T12:00:00Z",
        ],
      ],
    ] as const)("counts all four commits of %s, cached or not", ([, dates]) =>
      Effect.gen(function* () {
        const repo = yield* makeTempRepository;
        yield* commitRenameChain(repo, dates);

        assert.strictEqual(yield* commitsOfG(repo, false), 4);
        assert.strictEqual(yield* commitsOfG(repo, true), 4);
        assert.strictEqual(yield* commitsOfG(repo, true), 4);
      }),
    );
  },
);
