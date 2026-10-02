import { DateTime } from "effect";
import { describe, expect, it } from "vitest";

import { at, classifiedCommit } from "../testing/classified-commit.js";
import { overview } from "./overview.js";

const now = DateTime.makeUnsafe("2026-07-01T00:00:00Z");
const grace = { name: "Grace", email: "grace@example.com" };
const DAY = 86_400;
const nowSeconds = at("2026-07-01T00:00:00Z");

const run = (
  commits: Parameters<typeof overview>[0]["commits"],
  universe: Parameters<typeof overview>[0]["universe"] = [],
  history = commits,
) => overview({ commits, history, universe, now });

const person = (days: number, email: string) =>
  classifiedCommit({
    time: nowSeconds - days * DAY,
    author: { name: email, email },
  });

describe("overview", () => {
  it("counts the commits of every class in the window", () => {
    const result = run([
      classifiedCommit(),
      classifiedCommit({ class: "bot", tools: ["Dependabot"] }),
      classifiedCommit({ class: "agent", tools: ["Jules"] }),
    ]);

    expect(result.commits).toBe(3);
  });
});

describe("overview contributors", () => {
  it("counts contributors, without bots and agents", () => {
    const result = run([
      classifiedCommit(),
      classifiedCommit(),
      classifiedCommit({
        class: "agent-assisted",
        tools: ["Claude Code"],
        author: grace,
      }),
      classifiedCommit({
        class: "bot",
        tools: ["Dependabot"],
        author: { name: "d", email: "d@example.com" },
      }),
    ]);

    expect(result.contributors.total).toBe(2);
  });

  it("counts active contributors at 30, 90 and 365 days, including the edges", () => {
    const result = run([
      person(30, "on30@example.com"),
      person(31, "on31@example.com"),
      person(90, "on90@example.com"),
      person(91, "on91@example.com"),
      person(365, "on365@example.com"),
      person(366, "on366@example.com"),
    ]);

    expect(result.contributors).toStrictEqual({
      total: 6,
      active30: 1,
      active90: 3,
      active365: 5,
      allTime: 6,
    });
  });

  it("counts every contributor of the full history as all-time, whatever the window holds", () => {
    const inWindow = [person(10, "ada@example.com")];
    const history = [
      ...inWindow,
      person(500, "grace@example.com"),
      person(600, "ada@example.com"),
      classifiedCommit({
        class: "bot",
        tools: ["Dependabot"],
        author: { name: "d", email: "d@example.com" },
      }),
    ];

    expect(run(inWindow, [], history).contributors).toMatchObject({
      total: 1,
      allTime: 2,
    });
  });

  it("measures a contributor by their last commit, not their first", () => {
    const result = run([
      classifiedCommit({ time: nowSeconds - 400 * DAY }),
      classifiedCommit({ time: nowSeconds - 10 * DAY }),
    ]);

    expect(result.contributors.active30).toBe(1);
  });
});

describe("overview universe", () => {
  it("sums files and non-blank lines of the universe", () => {
    const result = run(
      [],
      [
        { path: "a.ts", loc: 10 },
        { path: "b.ts", loc: 5 },
      ],
    );

    expect(result).toMatchObject({ files: 2, loc: 15 });
  });

  it("groups the universe by language, sorts by lines descending then name, and names unknown extensions Other", () => {
    const result = run(
      [],
      [
        { path: "a.ts", loc: 10 },
        { path: "b.tsx", loc: 5 },
        { path: "c.css", loc: 15 },
        { path: "d.py", loc: 15 },
        { path: "notes.custom", loc: 1 },
        { path: "Makefile", loc: 2 },
      ],
    );

    expect(result.languages).toStrictEqual([
      { name: "CSS", files: 1, loc: 15 },
      { name: "Python", files: 1, loc: 15 },
      { name: "TypeScript", files: 2, loc: 15 },
      { name: "Other", files: 2, loc: 3 },
    ]);
  });

  it("reports zeros and no languages for an empty universe and no commits", () => {
    expect(run([])).toStrictEqual({
      commits: 0,
      contributors: {
        total: 0,
        active30: 0,
        active90: 0,
        active365: 0,
        allTime: 0,
      },
      files: 0,
      loc: 0,
      languages: [],
    });
  });
});
