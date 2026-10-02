// Tests only: achievement facts for a quiet repository, so a test states only what makes its achievement pass.
import { DateTime } from "effect";

import { achievements } from "../achievements/achievements.js";
import type { AchievementFacts } from "../achievements/achievements.js";
import type { ClassifiedCommit } from "../automation/classify.js";
import type { Achievement } from "../report/achievements.js";
import { at, classifiedCommit } from "./classified-commit.js";

/** 2026-07-01T00:00:00Z, a Wednesday. */
const now = DateTime.makeUnsafe("2026-07-01T00:00:00Z");

/**
 * Facts for 2026-07-01 with no commits, 10 files of TypeScript and no tests, a
 * truck factor of 0, and every path counting as code; `overrides` replace any field.
 */
export const achievementFacts = (
  overrides: Partial<AchievementFacts> = {},
): AchievementFacts => ({
  commits: [],
  now,
  shallow: false,
  isCodePath: () => true,
  stats: {
    files: 10,
    tests: { files: 0, lines: 0 },
    languages: [{ name: "TypeScript", files: 10, lines: 100 }],
  },
  truckFactor: 0,
  ...overrides,
});

/** One commit per ISO timestamp for each of `count` steps of `stepMs` from `start`, newest first. */
export const commitsEvery = (
  start: string,
  stepMs: number,
  count: number,
  overrides: (index: number) => Partial<ClassifiedCommit> = () => ({}),
): ReadonlyArray<ClassifiedCommit> =>
  Array.from({ length: count }, (_, index) =>
    classifiedCommit({
      time: at(start) + (index * stepMs) / 1000,
      ...overrides(index),
    }),
  ).toReversed();

/** The achievement of `kind` for quiet facts that `overrides` change. */
export const achievementOf = (
  kind: Achievement["kind"],
  overrides: Partial<AchievementFacts> = {},
): Achievement | undefined =>
  achievements(achievementFacts(overrides)).find(
    (entry) => entry.kind === kind,
  );

/** A commit at `time` that changes `files`, a path to its added and deleted lines. */
export const changing = (
  time: string,
  files: Readonly<Record<string, readonly [number, number]>>,
  subject = "",
): ClassifiedCommit =>
  classifiedCommit({
    time: at(time),
    subject,
    changes: Object.entries(files).map(([path, [added, deleted]]) => ({
      path,
      added,
      deleted,
    })),
  });
