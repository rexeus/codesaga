import { describe, expect, it } from "vitest";

import { at, classifiedCommit } from "../testing/classified-commit.js";
import { activity } from "./activity.js";

const isTypeScript = (path: string) => path.endsWith(".ts");

const run = (
  commits: Parameters<typeof activity>[0]["commits"],
  window: { since: string; until: string },
) => activity({ commits, window, isCodePath: isTypeScript });

describe("activity", () => {
  it("emits empty weeks and months inside the window with zeros", () => {
    const result = run(
      [
        classifiedCommit({ time: at("2026-01-05T10:00:00Z") }),
        classifiedCommit({ time: at("2026-03-16T10:00:00Z") }),
      ],
      { since: "2026-01-05T00:00:00.000Z", until: "2026-03-20T00:00:00.000Z" },
    );

    expect(result.weeks.map((week) => week.commits)).toStrictEqual([
      1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,
    ]);
    expect(result.months).toStrictEqual([
      { month: "2026-01", commits: 1, contributors: 1 },
      { month: "2026-02", commits: 0, contributors: 0 },
      { month: "2026-03", commits: 1, contributors: 1 },
    ]);
  });

  it("starts weeks on Monday across a year boundary", () => {
    const result = run(
      [
        classifiedCommit({ time: at("2025-12-28T23:00:00Z") }),
        classifiedCommit({ time: at("2025-12-29T01:00:00Z") }),
        classifiedCommit({ time: at("2026-01-04T23:00:00Z") }),
      ],
      { since: "2025-12-22T00:00:00.000Z", until: "2026-01-05T00:00:00.000Z" },
    );

    expect(
      result.weeks.map(({ start, commits }) => [start, commits]),
    ).toStrictEqual([
      ["2025-12-22", 1],
      ["2025-12-29", 2],
      ["2026-01-05", 0],
    ]);
  });
});

describe("activity contributors and lines", () => {
  it("counts the lines of code paths only, so a lockfile change adds nothing", () => {
    const result = run(
      [
        classifiedCommit({
          changes: [
            { path: "src/a.ts", added: 10, deleted: 2 },
            { path: "pnpm-lock.yaml", added: 900, deleted: 400 },
            { path: "src/b.ts", added: 5, deleted: 1 },
          ],
        }),
      ],
      { since: "2026-01-01T00:00:00.000Z", until: "2026-01-02T00:00:00.000Z" },
    );

    expect(result.weeks[0]).toMatchObject({ added: 15, deleted: 3 });
  });

  it("counts every class of commit in weeks and months, but only contributors as a month's contributors", () => {
    const time = at("2026-01-07T10:00:00Z");
    const result = run(
      [
        classifiedCommit({ time }),
        classifiedCommit({
          time,
          class: "agent-assisted",
          tools: ["Claude Code"],
          author: { name: "Grace", email: "grace@example.com" },
        }),
        classifiedCommit({
          time,
          class: "bot",
          tools: ["Dependabot"],
          author: { name: "dependabot[bot]", email: "bot@example.com" },
        }),
        classifiedCommit({
          time,
          class: "agent",
          tools: ["Jules"],
          author: { name: "jules", email: "jules@example.com" },
        }),
        classifiedCommit({ time }),
      ],
      { since: "2026-01-01T00:00:00.000Z", until: "2026-01-08T00:00:00.000Z" },
    );

    expect(result.weeks[1]?.commits).toBe(5);
    expect(result.months).toStrictEqual([
      { month: "2026-01", commits: 5, contributors: 2 },
    ]);
  });
});
