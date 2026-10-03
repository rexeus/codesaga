import { DateTime } from "effect";
import { describe, expect, it } from "vitest";

import type { FirstParentCommit } from "../../history/first-parent.js";
import type { HistoryFacts } from "../history-facts.js";
import { trendsOf } from "./trends.js";

const now = DateTime.makeUnsafe("2026-03-20T00:00:00Z");
const day = (offset: number) =>
  Date.parse("2026-01-01T12:00:00Z") / 1000 + offset * 86_400;

/** `count` commits that each flip `strict` in tsconfig.json. */
const flips = (count: number): HistoryFacts => {
  const firstParent: Array<FirstParentCommit> = Array.from(
    { length: count },
    (_, index) => ({
      sha: `c${index}`,
      time: day(index),
      changes: [
        {
          path: "tsconfig.json",
          oid: `v${index + 1}`,
          ...(index === 0 ? {} : { previousOid: `v${index}` }),
        },
      ],
    }),
  );
  const configs = new Map(
    Array.from({ length: count + 1 }, (_, index) => [
      `v${index}`,
      JSON.stringify({ compilerOptions: { strict: index % 2 === 1 } }),
    ]),
  );
  return { factsByBlob: new Map(), firstParent, configs };
};

describe("trendsOf events", () => {
  it("keeps the 20 newest flips in the report and every flip beside it", () => {
    const result = trendsOf({
      historyFacts: flips(25),
      window: [],
      scope: ".",
      now,
    });

    expect(result?.trends.events).toHaveLength(20);
    expect(result?.allFlagEvents).toHaveLength(25);
    expect(result?.trends.events).toStrictEqual(
      result?.allFlagEvents.slice(-20),
    );
  });

  it("has no trends when no commit of the chain has a date within the history", () => {
    const undated = flips(2);

    expect(
      trendsOf({
        historyFacts: {
          ...undated,
          firstParent: undated.firstParent.map((commit) =>
            Object.assign({}, commit, { time: Number.NaN }),
          ),
        },
        window: [],
        scope: ".",
        now,
      }),
    ).toBeUndefined();
  });
});

describe("trendsOf lastCommitDays", () => {
  it("dates each month by the last commit of the chain in it or before it", () => {
    // 40 commits from 2026-01-01 to 2026-02-09, and no commit in March.
    const result = trendsOf({
      historyFacts: flips(40),
      window: [],
      scope: ".",
      now,
    });

    expect(result?.trends.months).toStrictEqual([
      "2026-01",
      "2026-02",
      "2026-03",
    ]);
    expect(result?.lastCommitDays).toStrictEqual([
      "2026-01-31",
      "2026-02-09",
      "2026-02-09",
    ]);
  });
});
