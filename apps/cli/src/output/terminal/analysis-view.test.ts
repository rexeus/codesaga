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
      "Automation                 agent-assisted 9% · agent 5% · bot 9%",
      "                           Claude Code 196 · Dependabot 108 · GitHub Actions 88",
      "Languages                  TypeScript 76% · CSS 13% · SQL 5% · JavaScript 4% · Shell 1%",
      "",
      "--html for the dashboard, --json for agents",
    ]);
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
  });

  it("bolds the headline and labels only when styled", () => {
    const styled = renderAnalysis(sampleReport(), makeStyle(true));

    expect(styled).toContain("\u001B[1mcodesaga · aurora-web");
    expect(styled).toContain("\u001B[1mAutomation");
  });
});
