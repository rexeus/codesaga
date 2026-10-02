// Tests only: story facts for a quiet repository, so a test states only what makes its story pass.
import { DateTime } from "effect";

import type { ClassifiedCommit } from "../automation/classify.js";
import type { StoryFacts } from "../stories/stories.js";
import { at, classifiedCommit } from "./classified-commit.js";

/** 2026-07-01T00:00:00Z, a Wednesday. */
const now = DateTime.makeUnsafe("2026-07-01T00:00:00Z");

/**
 * Facts for 2026-07-01 with no commits, a truck factor of 3 and `.ts` as the
 * only code; `overrides` replace any field.
 */
export const storyFacts = (
  overrides: Partial<StoryFacts> = {},
): StoryFacts => ({
  commits: [],
  now,
  shallow: false,
  isCodePath: (path) => path.endsWith(".ts"),
  knowledge: { files: 10, truckFactor: { value: 3, people: [] } },
  ...overrides,
});

/** One human commit per ISO timestamp, by `author` (Ada by default), newest first. */
export const commitsAt = (
  times: ReadonlyArray<string>,
  overrides: Partial<ClassifiedCommit> = {},
): ReadonlyArray<ClassifiedCommit> =>
  times
    .map((time) => classifiedCommit({ time: at(time), ...overrides }))
    .toSorted((a, b) => b.time - a.time);
