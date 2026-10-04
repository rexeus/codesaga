import { describe, expect, it } from "vitest";

import { storyFacts } from "../testing/story-facts.js";
import {
  configPosture,
  deepDiveWith,
  strictnessBlock,
} from "../testing/typescript-blocks.js";
import type { TrendInput } from "../typescript/trend-input.js";

type FlagChange = TrendInput["events"][number];
import { stories } from "./stories.js";

/** `count` months from 2024-01, with the given series; each value is the series at every month, or a function of the month's index. */
const monthOf = (index: number): string =>
  `${2024 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;

/** Months from 2024-01, whose last commit is on the 28th; each series value is a function of the month's index. */
const trendsOf = (
  count: number,
  series: Record<string, (index: number) => number>,
  events: ReadonlyArray<FlagChange> = [],
): TrendInput => ({
  months: Array.from({ length: count }, (_, index) => monthOf(index)),
  lastCommitDays: Array.from(
    { length: count },
    (_, index) => `${monthOf(index)}-28`,
  ),
  series: Object.fromEntries(
    Object.entries(series).map(([name, at]) => [
      name,
      Array.from({ length: count }, (_, index) => at(index)),
    ]),
  ),
  events,
});

const storiesFor = (trends: TrendInput, typescript = deepDiveWith({})) =>
  stories(storyFacts({ typescript, trends }));

const strictOn = (path: string): FlagChange => ({
  date: "2024-03-11",
  path,
  flag: "strict",
  from: false,
  to: true,
});

const dive = (strict: boolean) =>
  deepDiveWith({
    strictness: strictnessBlock([
      configPosture("tsconfig.json", 50, strict),
      configPosture("tools/tsconfig.json", 5, false),
    ]),
  });

describe("strict-since", () => {
  it("names the day strict was turned on in the config that governs the most files", () => {
    // 2024-01 to 2026-03 is 27 months; 2024-03 to 2026-03 is 24.
    expect(
      storiesFor(trendsOf(27, {}, [strictOn("tsconfig.json")]), dive(true)),
    ).toStrictEqual([
      {
        kind: "strict-since",
        title: "Strict since",
        detail: "strict was switched on in tsconfig.json on 2024-03-11.",
        value: 24,
        date: "2024-03-11",
        path: "tsconfig.json",
      },
    ]);
  });
});

describe("strict-since and base configs", () => {
  it("names the base config that flipped, not the config that only extends it", () => {
    const child = {
      ...configPosture("apps/web/tsconfig.json", 50, true),
      extends: ["tsconfig.base.json"],
    };
    const typescript = deepDiveWith({ strictness: strictnessBlock([child]) });
    const events = [
      strictOn("tsconfig.base.json"),
      strictOn("apps/web/tsconfig.json"),
    ];

    const [story] = storiesFor(trendsOf(27, {}, events), typescript);

    expect(story).toMatchObject({
      detail: "strict was switched on in tsconfig.base.json on 2024-03-11.",
      path: "tsconfig.base.json",
    });
  });

  it("names the config itself when its base did not flip on that day", () => {
    const child = {
      ...configPosture("apps/web/tsconfig.json", 50, true),
      extends: ["tsconfig.base.json"],
    };
    const typescript = deepDiveWith({ strictness: strictnessBlock([child]) });
    const base = { ...strictOn("tsconfig.base.json"), date: "2023-01-05" };

    const [story] = storiesFor(
      trendsOf(27, {}, [base, strictOn("apps/web/tsconfig.json")]),
      typescript,
    );

    expect(story?.path).toBe("apps/web/tsconfig.json");
  });

  it("is not there when strict is off today, when the newest change turned it off, or for another config", () => {
    const events = [strictOn("tsconfig.json")];

    expect(storiesFor(trendsOf(27, {}, events), dive(false))).toStrictEqual([]);
    expect(
      storiesFor(
        trendsOf(27, {}, [
          ...events,
          {
            ...strictOn("tsconfig.json"),
            date: "2025-01-02",
            from: true,
            to: false,
          },
        ]),
        dive(true),
      ),
    ).toStrictEqual([]);
    expect(
      storiesFor(
        trendsOf(27, {}, [strictOn("tools/tsconfig.json")]),
        dive(true),
      ),
    ).toStrictEqual([]);
  });
});

const escapeRate = (before: number, now: number, lines = 10_000) =>
  trendsOf(14, {
    "production.lines": () => lines,
    // 14 points: index 1 is 12 months before the last point, index 13.
    "production.escapes": (index) => (index === 13 ? now : before),
  });

describe("type-trend", () => {
  it("words a fall of 60% in the last 12 months neutrally", () => {
    expect(storiesFor(escapeRate(100, 40))).toStrictEqual([
      {
        kind: "type-trend",
        title: "Escape hatches",
        detail:
          "Production escape hatches per 1,000 lines fell by 60% in the last 12 months, from 10 to 4.",
        value: -0.6,
      },
    ]);
  });

  it("words a rise the same way", () => {
    const [story] = storiesFor(escapeRate(100, 160));

    expect(story?.detail).toBe(
      "Production escape hatches per 1,000 lines rose by 60% in the last 12 months, from 10 to 16.",
    );
    expect(story?.value).toBe(0.6);
  });

  it("needs a change of 30% in either direction", () => {
    expect(
      storiesFor(escapeRate(100, 70)).map(({ kind }) => kind),
    ).toStrictEqual(["type-trend"]);
    expect(storiesFor(escapeRate(100, 71))).toStrictEqual([]);
    expect(
      storiesFor(escapeRate(100, 130)).map(({ kind }) => kind),
    ).toStrictEqual(["type-trend"]);
    expect(storiesFor(escapeRate(100, 129))).toStrictEqual([]);
  });

  it("needs 10 escape hatches, 1,000 lines and 13 months of history", () => {
    expect(storiesFor(escapeRate(5, 9, 1_000))).toStrictEqual([]);
    expect(
      storiesFor(escapeRate(10, 4, 1_000)).map(({ kind }) => kind),
    ).toStrictEqual(["type-trend"]);
    expect(storiesFor(escapeRate(100, 40, 999))).toStrictEqual([]);
    expect(
      storiesFor(
        trendsOf(12, {
          "production.lines": () => 10_000,
          "production.escapes": (index) => (index === 11 ? 40 : 100),
        }),
      ),
    ).toStrictEqual([]);
  });

  it("says nothing of a start without escape hatches", () => {
    expect(storiesFor(escapeRate(0, 40))).toStrictEqual([]);
  });
});

const modules = (
  esm: number,
  commonjs: (index: number) => number,
  count = 10,
) =>
  trendsOf(count, {
    "production.esmFiles": () => esm,
    "production.commonjsFiles": commonjs,
  });

describe("module-era", () => {
  it("names the month since which no production file uses CommonJS", () => {
    // CommonJS until index 5 (2024-06), none from index 6 (2024-07).
    expect(
      storiesFor(modules(30, (index) => (index <= 5 ? 4 : 0))),
    ).toStrictEqual([
      {
        kind: "module-era",
        title: "ESM only",
        detail:
          "No production file has used CommonJS since the end of 2024-07.",
        value: 0,
        date: "2024-07-28",
      },
    ]);
  });

  it("says nothing of a code base that was never CommonJS", () => {
    expect(storiesFor(modules(30, () => 0))).toStrictEqual([]);
  });

  it("names a CommonJS share of at least half", () => {
    expect(storiesFor(modules(10, () => 10))).toStrictEqual([
      {
        kind: "module-era",
        title: "CommonJS code",
        detail: "50% of the production module files use CommonJS.",
        value: 0.5,
      },
    ]);
    expect(storiesFor(modules(11, () => 10))).toStrictEqual([]);
  });

  it("needs 10 module files", () => {
    expect(storiesFor(modules(4, () => 6))).toHaveLength(1);
    expect(storiesFor(modules(4, () => 5))).toStrictEqual([]);
  });
});

describe("the stories of the history", () => {
  it("are absent without trends", () => {
    expect(stories(storyFacts({ typescript: deepDiveWith({}) }))).toStrictEqual(
      [],
    );
  });
});

describe("strict-since without a flip of the config itself", () => {
  it("reads the flip of the nearest base that has one", () => {
    const child = {
      ...configPosture("tsconfig.tests.json", 50, true),
      extends: ["tsconfig.base.json"],
    };
    const typescript = deepDiveWith({ strictness: strictnessBlock([child]) });

    const [story] = storiesFor(
      trendsOf(27, {}, [strictOn("tsconfig.base.json")]),
      typescript,
    );

    expect(story).toMatchObject({
      date: "2024-03-11",
      path: "tsconfig.base.json",
    });
  });
});

const created = (date: string): FlagChange => ({
  ...strictOn("tsconfig.json"),
  date,
  from: null,
});

describe("strict-since wording", () => {
  it("says a config created strict was created, not switched, and names the day", () => {
    const [story] = storiesFor(
      trendsOf(27, {}, [created("2024-03-11")]),
      dive(true),
    );

    expect(story).toMatchObject({
      title: "Strict since",
      detail:
        "strict has been on in tsconfig.json since the config was created on 2024-03-11.",
      date: "2024-03-11",
    });
  });

  it("says only that a config strict in the first commit read has been on since then, which a shallow clone or a late first-parent chain makes no claim about", () => {
    const [story] = storiesFor(
      trendsOf(27, {}, [created("2024-01-15")]),
      dive(true),
    );

    expect(story).toMatchObject({
      title: "Strict since the first commit read",
      detail:
        "strict has been on in tsconfig.json since the first commit read, in 2024-01.",
      value: 26,
    });
  });

  it("keeps the switch wording for a flip in the first month", () => {
    const [story] = storiesFor(
      trendsOf(27, {}, [{ ...strictOn("tsconfig.json"), date: "2024-01-15" }]),
      dive(true),
    );

    expect(story?.detail).toBe(
      "strict was switched on in tsconfig.json on 2024-01-15.",
    );
  });
});

describe("strict-since beside a config that is gone", () => {
  it("names the config that exists today and not a later strict config of an old history that was deleted", () => {
    const events: ReadonlyArray<FlagChange> = [
      { ...strictOn("tsconfig.json"), from: null },
      {
        ...strictOn("legacy/test/fixtures/tsconfig.json"),
        date: "2024-06-01",
        from: null,
      },
    ];

    expect(storiesFor(trendsOf(27, {}, events), dive(true))).toStrictEqual([
      {
        kind: "strict-since",
        title: "Strict since",
        detail:
          "strict has been on in tsconfig.json since the config was created on 2024-03-11.",
        value: 24,
        date: "2024-03-11",
        path: "tsconfig.json",
      },
    ]);
  });
});
