import { describe, expect, it } from "vitest";

import type { ClassifiedCommit } from "../automation/classify.js";
import type { Highlight } from "../report/highlights.js";
import { at, classifiedCommit } from "../testing/classified-commit.js";
import { commitsAt, highlightFacts } from "../testing/highlight-facts.js";
import { historyEventHighlights } from "./history-events.js";

// The facts' now is Wednesday 2026-07-01T00:00:00Z.
const run = (commits: ReadonlyArray<ClassifiedCommit>) =>
  historyEventHighlights(highlightFacts({ commits }));

const anniversaryOf = (firstCommit: string) =>
  run(commitsAt([firstCommit, "2026-06-01T00:00:00Z"])).filter(
    ({ kind }) => kind === "anniversary",
  );

describe("historyEventHighlights anniversary", () => {
  it("reports a yearly anniversary 4 days ahead", () => {
    expect(anniversaryOf("2021-07-05T10:00:00Z")).toStrictEqual([
      {
        kind: "anniversary",
        title: "Anniversary",
        detail: "The first commit turns 5 years old on 2026-07-05.",
        value: 5,
        date: "2026-07-05",
      },
    ]);
  });

  it("reports an anniversary 7 days past and none 8 days away on either side", () => {
    expect(anniversaryOf("2021-06-24T10:00:00Z")).toMatchObject([
      {
        value: 5,
        detail: "The first commit turned 5 years old on 2026-06-24.",
      },
    ]);
    expect(anniversaryOf("2021-06-23T10:00:00Z")).toStrictEqual([]);
    expect(anniversaryOf("2021-07-09T10:00:00Z")).toStrictEqual([]);
  });

  it("reports the 100-day milestone", () => {
    expect(anniversaryOf("2026-03-23T10:00:00Z")).toMatchObject([
      {
        value: 100,
        detail: "The first commit turned 100 days old on 2026-07-01.",
        date: "2026-07-01",
      },
    ]);
  });

  it("reports the 500- and 1000-day milestones", () => {
    // 500 days after 2025-02-16 is 2026-07-01; 1000 days after 2023-10-06 is 2026-07-02
    expect(anniversaryOf("2025-02-16T10:00:00Z")).toMatchObject([
      { value: 500 },
    ]);
    expect(anniversaryOf("2023-10-06T10:00:00Z")).toMatchObject([
      { value: 1000, date: "2026-07-02" },
    ]);
  });

  it("reports nothing for a history without commits", () => {
    expect(run([])).toStrictEqual([]);
  });
});

const ada = { name: "Ada", email: "ada@example.com" };
const person = (index: number) => ({
  name: `Person ${index}`,
  email: `p${index}@example.com`,
});
const withNewcomers = (...times: ReadonlyArray<string>) => [
  ...commitsAt(["2025-01-01T00:00:00Z"], { author: ada }),
  ...times.flatMap((time, index) =>
    commitsAt([time], { author: person(index) }),
  ),
];

const newcomersOf = (...times: ReadonlyArray<string>) =>
  found("newcomers", ...withNewcomers(...times));

const found = (
  kind: string,
  ...commits: ReadonlyArray<ClassifiedCommit>
): ReadonlyArray<Highlight> =>
  run(commits).filter((highlight) => highlight.kind === kind);

const rename = (path: string, time: string, previousLife = false) =>
  classifiedCommit({
    time: at(time),
    changes: [
      {
        path,
        added: 0,
        deleted: 0,
        renamed: true,
        ...(previousLife ? { previousLife: true as const } : {}),
      },
    ],
  });

const cleanup = (deleted: number, added = 10, path = "src/a.ts") =>
  classifiedCommit({
    time: at("2026-02-03T23:30:00Z"),
    changes: [{ path, added, deleted }],
  });

describe("historyEventHighlights newcomers", () => {
  it("reports 2 people whose first commit is at most 90 days old", () => {
    // 90 days before 2026-07-01 is 2026-04-02
    expect(
      newcomersOf("2026-04-02T00:00:00Z", "2026-06-20T00:00:00Z"),
    ).toStrictEqual([
      {
        kind: "newcomers",
        title: "Newcomers",
        detail:
          "2 of 3 contributors made their first commit in the last 90 days.",
        value: 2,
        people: [
          { name: "Person 0", email: "p0@example.com" },
          { name: "Person 1", email: "p1@example.com" },
        ],
      },
    ]);
  });

  it("reports no newcomers with 1 person, or when the second started 91 days ago", () => {
    expect(newcomersOf("2026-06-20T00:00:00Z")).toStrictEqual([]);
    expect(
      newcomersOf("2026-04-01T23:59:59Z", "2026-06-20T00:00:00Z"),
    ).toStrictEqual([]);
  });

  it("names at most five newcomers but counts all", () => {
    const [newcomer] = newcomersOf(
      ...Array.from({ length: 7 }, (_, i) => `2026-06-0${i + 1}T00:00:00Z`),
    );

    expect(newcomer?.value).toBe(7);
    expect(newcomer?.people).toHaveLength(5);
  });

  it("reports no newcomers when every contributor is new", () => {
    const everyoneNew = [0, 1].flatMap((index) =>
      commitsAt(["2026-06-01T00:00:00Z"], { author: person(index) }),
    );

    expect(found("newcomers", ...everyoneNew)).toStrictEqual([]);
  });

  it("does not count bots as newcomers", () => {
    const bots = [1, 2].flatMap((index) =>
      commitsAt(["2026-06-20T00:00:00Z"], {
        class: "bot",
        tools: ["Dependabot"],
        author: person(index),
      }),
    );

    expect(found("newcomers", ...bots, ...withNewcomers())).toStrictEqual([]);
  });
});

describe("historyEventHighlights rename record", () => {
  it("reports the most renamed file at 3 renames, under its path today", () => {
    expect(
      found(
        "rename-record",
        rename("src/c.ts", "2026-03-03T00:00:00Z"),
        rename("src/c.ts", "2026-03-02T00:00:00Z"),
        rename("src/c.ts", "2026-03-01T00:00:00Z"),
        rename("src/other.ts", "2026-03-01T00:00:00Z"),
      ),
    ).toStrictEqual([
      {
        kind: "rename-record",
        title: "Rename record",
        detail: "src/c.ts was renamed 3 times and kept its history.",
        value: 3,
        path: "src/c.ts",
      },
    ]);
  });

  it("reports no record at 2 renames", () => {
    expect(
      found(
        "rename-record",
        rename("src/c.ts", "2026-03-02T00:00:00Z"),
        rename("src/c.ts", "2026-03-01T00:00:00Z"),
      ),
    ).toStrictEqual([]);
  });

  it("does not count renames of a file that was deleted later", () => {
    const dead = rename("src/c.ts", "2026-03-01T00:00:00Z", true);

    expect(found("rename-record", dead, dead, dead)).toStrictEqual([]);
  });
});

describe("historyEventHighlights biggest cleanup", () => {
  it("reports the commit with the most net deleted code lines at 200", () => {
    expect(found("biggest-cleanup", cleanup(210), cleanup(50))).toStrictEqual([
      {
        kind: "biggest-cleanup",
        title: "Biggest cleanup",
        detail: "One commit removed 200 more code lines than it added.",
        value: 200,
        date: "2026-02-03",
      },
    ]);
  });

  it("reports no cleanup at 199 net lines, or when every commit adds more than it removes", () => {
    expect(found("biggest-cleanup", cleanup(209))).toStrictEqual([]);
    expect(found("biggest-cleanup", cleanup(5, 400))).toStrictEqual([]);
  });

  it("counts code files only", () => {
    expect(
      found("biggest-cleanup", cleanup(900, 0, "docs/old.md")),
    ).toStrictEqual([]);
  });
});
