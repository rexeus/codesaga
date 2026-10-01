import { describe, expect, it } from "vitest";

import { sampleReport } from "../../testing/sample-report.js";
import { renderAnalysis } from "./analysis-view.js";
import { makeStyle } from "./style.js";

const plain = makeStyle(false);

/** Characters other than the line breaks we print that could drive a terminal. */
const controlCharacters = (text: string): ReadonlyArray<string> =>
  text.split("").filter((character) => {
    const code = character.codePointAt(0) ?? 0;
    return (code < 0x20 && character !== "\n") || code === 0x7f;
  });

describe("renderAnalysis", () => {
  it("summarizes the sample report in the documented layout", () => {
    expect(renderAnalysis(sampleReport(), plain).split("\n")).toStrictEqual([
      "codesaga · aurora-web · main @ 9f3c2b1",
      "2 years · 2,246 commits · 8 contributors, 3 active in 90 days · 60,942 lines in 7 languages",
      "",
      "Activity, last 12 months   █▆█▇▇▆▇▆▅▅▄▅  724 commits",
      "Contributors               commits  active days  last commit",
      "  Maya Lindqvist               690          486  today",
      "  Tomás Herrera                430          330  11 days ago",
      "  Priya Raman                  310          258  1 month ago",
      "  Jonas Weber                  205          175  3 months ago",
      "  Aiko Tanaka                  135          120  4 months ago",
      "Truck factor               2 · Maya Lindqvist, Tomás Herrera",
      "Knowledge risks            files  flags             leading expert",
      "  docs                        14  orphaned, island  Lena Fischer 93% (inactive)",
      "  packages/db                 52  orphaned          Dmitri Volkov 69% (inactive)",
      "  packages/auth               19  island            Jonas Weber 95%",
      "  apps/admin                  58                    Aiko Tanaka 72%",
      "  infra                       27                    Tomás Herrera 78%",
      "Automation                 agent-assisted 9% · agent 5% · bot 9%",
      "                           Claude Code 196 · Dependabot 108 · GitHub Actions 88",
      "Languages                  TypeScript 76% · CSS 13% · SQL 5% · JavaScript 4% · Shell 1%",
      "",
      "--html for the dashboard, --json for agents",
    ]);
  });
});

describe("renderAnalysis knowledge", () => {
  it("prints no ANSI codes with plain style and marks an inactive person in the truck factor", () => {
    const report = sampleReport();
    const text = renderAnalysis(
      {
        ...report,
        knowledge: {
          ...report.knowledge,
          truckFactor: {
            value: 2,
            people: report.knowledge.truckFactor.people.map((person, index) =>
              Object.assign({}, person, { active: index === 0 }),
            ),
          },
        },
      },
      plain,
    );

    expect(text).toContain(
      "Truck factor               2 · Maya Lindqvist, Tomás Herrera (inactive)",
    );
    expect(text).not.toContain("\u001B");
  });

  it("says when most files have no expert and omits the directory table without directories", () => {
    const report = sampleReport();
    const lines = renderAnalysis(
      {
        ...report,
        knowledge: {
          ...report.knowledge,
          truckFactor: { value: 0, people: [] },
          directories: [],
        },
      },
      plain,
    ).split("\n");

    expect(lines).toContain(
      "Truck factor               0 · most files have no expert",
    );
    expect(lines.some((line) => line.startsWith("Knowledge risks"))).toBe(
      false,
    );
  });
});

describe("renderAnalysis truck factor", () => {
  it("lists a large truck factor as three names and a count", () => {
    const report = sampleReport();
    const [first] = report.knowledge.truckFactor.people;
    const people = Array.from({ length: 20 }, (_, index) =>
      Object.assign({}, first, { name: `Person ${index + 1}` }),
    );
    const lines = renderAnalysis(
      {
        ...report,
        knowledge: {
          ...report.knowledge,
          truckFactor: { value: 20, people },
        },
      },
      plain,
    ).split("\n");

    expect(lines).toContain(
      "Truck factor               20 · Person 1, Person 2, Person 3 and 17 more",
    );
  });

  it("cuts a long name with control characters on whole escapes", () => {
    const report = sampleReport();
    const [first] = report.knowledge.truckFactor.people;
    const name = `${"a".repeat(21)}\u001B[31mred`;
    const lines = renderAnalysis(
      {
        ...report,
        knowledge: {
          ...report.knowledge,
          truckFactor: {
            value: 1,
            people: [Object.assign({}, first, { name })],
          },
        },
      },
      plain,
    ).split("\n");

    expect(lines).toContain(
      `Truck factor               1 · ${"a".repeat(21)}…`,
    );
  });
});

const soleAuthor = (active: boolean) => {
  const report = sampleReport();
  const [first] = report.knowledge.truckFactor.people;
  const person = Object.assign({}, first, {
    name: "Dennis Wentzien",
    active,
  });
  return {
    ...report,
    overview: {
      ...report.overview,
      contributors: { total: 1, active30: 1, active90: 1, active365: 1 },
    },
    knowledge: {
      ...report.knowledge,
      truckFactor: { value: 1, people: [person] },
    },
  };
};

describe("renderAnalysis in a single-author repository", () => {
  it("says once that one person is the only expert instead of listing islands", () => {
    const lines = renderAnalysis(soleAuthor(true), plain).split("\n");

    expect(lines).toContain(
      "Knowledge                  one contributor — Dennis Wentzien is the only expert everywhere",
    );
    expect(lines.some((line) => line.startsWith("Truck factor"))).toBe(false);
    expect(lines.some((line) => line.startsWith("Knowledge risks"))).toBe(
      false,
    );
    expect(lines.some((line) => line.includes("island"))).toBe(false);
  });

  it("marks a sole contributor who is no longer active", () => {
    expect(renderAnalysis(soleAuthor(false), plain)).toContain(
      "one contributor — Dennis Wentzien (inactive) is the only expert everywhere",
    );
  });
});

describe("renderAnalysis comparison", () => {
  const figures = {
    commits: 100,
    activeContributors: 4,
    added: 0,
    deleted: 0,
    automation: { human: 100, agentAssisted: 0, agent: 0, bot: 0 },
    aiShare: 0,
  };
  const comparison = {
    previous: {
      since: "2025-10-15T00:00:00.000Z",
      until: "2026-01-15T00:00:00.000Z",
      ...figures,
    },
    current: figures,
    delta: {
      commits: { change: 18, ratio: 0.183 },
      activeContributors: { change: -1, ratio: -0.25 },
      added: { change: 40, ratio: null },
      deleted: { change: 0, ratio: null },
      aiShare: 0.044,
    },
  };

  it("puts the deltas on one line under the summary", () => {
    const lines = renderAnalysis(
      { ...sampleReport(), comparison },
      plain,
    ).split("\n");

    expect(lines[2]).toBe(
      "vs 2025-10-15 – 2026-01-15 · commits +18% · contributors -1 · lines added +40 · AI share +4 pts",
    );
  });

  it("shows no comparison line without --compare", () => {
    expect(renderAnalysis(sampleReport(), plain)).not.toContain("vs previous");
  });
});

describe("renderAnalysis edge cases", () => {
  it("names a repository without commits and omits what it cannot know", () => {
    const report = sampleReport();
    const empty = {
      ...report,
      repository: {
        ...report.repository,
        head: null,
        branch: null,
        firstCommitAt: null,
        lastCommitAt: null,
      },
      overview: {
        ...report.overview,
        commits: 0,
        contributors: { total: 0, active30: 0, active90: 0, active365: 0 },
        loc: 0,
        languages: [],
      },
      contributors: [],
      automation: {
        ...report.automation,
        totals: { human: 0, agentAssisted: 0, agent: 0, bot: 0 },
        tools: [],
      },
    };

    const lines = renderAnalysis(empty, plain).split("\n");

    expect(lines[0]).toBe("codesaga · aurora-web · no commits");
    expect(lines[1]).toBe(
      "0 commits · 0 contributors, 0 active in 90 days · 0 lines in 0 languages",
    );
    expect(lines).toContain("Automation                 none detected");
    expect(lines).toContain("Languages                  no code files");
  });
});

describe("renderAnalysis escaping", () => {
  it("escapes control characters in names that came from git", () => {
    const report = sampleReport();
    const hostile = {
      ...report,
      repository: {
        ...report.repository,
        name: "repo\u001B[31m",
        branch: "b\nc",
      },
      contributors: report.contributors.map((person) => ({
        ...person,
        name: "\u001B[2Jevil",
      })),
      knowledge: {
        ...report.knowledge,
        directories: report.knowledge.directories.map((directory) => ({
          ...directory,
          path: "dir\u001B[31m",
        })),
      },
      automation: {
        ...report.automation,
        tools: [
          {
            name: "bot\u0007[bot]",
            kind: "bot" as const,
            authored: 1,
            assisted: 0,
          },
        ],
      },
    };

    const text = renderAnalysis(hostile, plain);

    expect(controlCharacters(text)).toStrictEqual([]);
    expect(text).toContain("repo\\u001b[31m");
    expect(text).toContain("b\\u000ac");
    expect(text).toContain("\\u001b[2Jevil");
    expect(text).toContain("bot\\u0007[bot] 1");
    expect(text).toContain("dir\\u001b[31m");
  });

  it("bolds the headline and labels only when styled", () => {
    const styled = renderAnalysis(sampleReport(), makeStyle(true));

    expect(styled).toContain("\u001B[1mcodesaga · aurora-web");
    expect(styled).toContain("\u001B[1mAutomation");
  });
});
