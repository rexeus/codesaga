import { describe, expect, it } from "vitest";

import { samplePullRequests } from "../../testing/sample-pull-requests.js";
import { mapTerritories, sampleReport } from "../../testing/sample-report.js";
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
      "2 years · 2,246 commits · 8 contributors, 4 active in 90 days · 60,942 lines in 7 languages",
      "",
      "Stories                    Orphaned knowledge: 30 of 52 files in packages/db have no active expert.",
      "                           Quiet corner: docs/guides has not changed since 2026-01-12.",
      '                           Biggest cleanup: One commit removed 4,120 more code lines than it added: "Drop the legacy checkout flow".',
      "Activity, last 12 months   █▆█▇▇▆▇▆▅▅▄▅  724 commits",
      "Contributors               commits  active days  last commit",
      "  Maya Lindqvist               690          486  today",
      "  Tomás Herrera                430          330  11 days ago",
      "  Priya Raman                  310          258  1 month ago",
      "  Jonas Weber                  205          175  3 months ago",
      "  Aiko Tanaka                  135          120  4 months ago",
      "Truck factor               2 · Maya Lindqvist, Tomás Herrera",
      "Knowledge territories      files  flags             leading expert               leading line owner",
      "  docs                        14  orphaned, island  Lena Fischer 93% (dormant)   Lena Fischer 86%",
      "  packages/db                 52  orphaned          Dmitri Volkov 69% (dormant)  Dmitri Volkov 67%",
      "  packages/auth               19  island            Jonas Weber 95%",
      "  apps/admin                  58                    Aiko Tanaka 72%",
      "  infra                       27                    Tomás Herrera 78%",
      "                           Territories at detail 1 of 3 (recommended: 1)",
      "                           detail 1: 11 territories (without other files) for 4 active contributors",
      "Stats                      473 files · 60,942 lines · 25% tests",
      "                           median file 96 lines · 5 revisions per file · 1.70 indentation levels per line",
      "                           2 spaces · lines 33 median, 72 p90 · 8% comments",
      "Achievements               4 of 9 · First 1,000 commits · Marathon · Polyglot · Spring cleaning",
      "Automation                 agent-assisted 9% · agent 5% · bot 9%",
      "                           Claude Code 196 · Dependabot 108 · GitHub Actions 88",
      "Languages                  TypeScript 76% · CSS 13% · SQL 5% · JavaScript 4% · Shell 1%",
      "",
      "--html for the dashboard, --json for agents",
    ]);
  });
});

describe("renderAnalysis stories and automation", () => {
  it("shows only the top 3 stories and leaves the block out without any", () => {
    const report = sampleReport();

    const withSix = renderAnalysis(report, plain);
    const without = renderAnalysis({ ...report, stories: [] }, plain);

    expect(withSix.match(/^ {27}\S.*(?:cleanup|corner)/gmu)).toHaveLength(2);
    expect(withSix).not.toContain("Longest streak");
    expect(without).not.toContain("Stories");
  });

  it("shows the automation line only when a bot or an agent was detected", () => {
    const report = sampleReport();
    const quiet = {
      ...report,
      automation: { ...report.automation, tools: [] },
    };

    expect(renderAnalysis(report, plain)).toContain("\nAutomation ");
    expect(renderAnalysis(quiet, plain)).not.toContain("Automation");
  });
});

type Stats = ReturnType<typeof sampleReport>["stats"];

/** The sample report's stats with `style.indent` replaced, as the last line of the Stats block shows it. */
const styleLineWith = (
  indent: Stats["style"]["indent"],
): string | undefined => {
  const { stats } = sampleReport();
  return renderAnalysis(
    {
      ...sampleReport(),
      stats: { ...stats, style: { ...stats.style, indent } },
    },
    plain,
  )
    .split("\n")
    .find((line) => line.includes(" median, ") && line.includes("comments"));
};

describe("renderAnalysis stats", () => {
  it("names tabs when most indented lines start with one", () => {
    expect(
      styleLineWith({ spacesShare: 0.2, tabsShare: 0.8, width: 2 }),
    ).toMatch(/^ {27}tabs · lines /u);
  });

  it("says so for code without an indented line", () => {
    expect(styleLineWith({ spacesShare: 0, tabsShare: 0, width: 0 })).toMatch(
      /^ {27}no indentation · /u,
    );
  });

  it("says so for a repository without code files", () => {
    const report = sampleReport();

    expect(
      renderAnalysis(
        { ...report, stats: { ...report.stats, files: 0 } },
        plain,
      ),
    ).toContain("\nStats                      no code files\n");
  });
});

describe("renderAnalysis achievements", () => {
  it("counts the reached ones and names none that is locked", () => {
    const report = sampleReport();
    const locked = report.achievements.map((achievement) => ({
      ...achievement,
      reached: false,
    }));

    expect(
      renderAnalysis({ ...report, achievements: locked }, plain),
    ).toContain("\nAchievements               0 of 9\n");
  });
});

describe("renderAnalysis pull requests", () => {
  it("adds the pull request block between automation and languages", () => {
    const lines = renderAnalysis(
      { ...sampleReport(), pullRequests: samplePullRequests() },
      plain,
    ).split("\n");

    const automation = lines.findIndex((line) => line.startsWith("Automation"));
    expect(lines.slice(automation + 2, automation + 6)).toStrictEqual([
      "Pull requests              48 opened · 41 merged · 3 closed unmerged",
      "                           median 8.5 h to merge · 1.5 h to first review",
      "                           reviews by tomas 31 · maya 22 · priya 15",
      expect.stringMatching(/^Languages /u),
    ]);
  });
});

describe("renderAnalysis incomplete pull requests", () => {
  it("says when some pull requests have more reviews than were fetched", () => {
    const lines = renderAnalysis(
      {
        ...sampleReport(),
        pullRequests: { ...samplePullRequests(), reviewsTruncated: true },
      },
      plain,
    ).split("\n");

    expect(lines).toContain(
      "                           incomplete: some pull requests have more reviews than were fetched",
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
      partial: false,
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

  it("says n/a for an AI share change that has no commits to compare", () => {
    const noShare = {
      ...comparison,
      delta: { ...comparison.delta, aiShare: null },
    };

    expect(
      renderAnalysis({ ...sampleReport(), comparison: noShare }, plain),
    ).toContain("lines added +40 · AI share n/a");
  });

  it("notes a previous period that starts before the first commit", () => {
    const partial = {
      ...comparison,
      previous: { ...comparison.previous, partial: true },
    };

    expect(
      renderAnalysis({ ...sampleReport(), comparison: partial }, plain).split(
        "\n",
      )[2],
    ).toBe(
      "vs 2025-10-15 – 2026-01-15 · commits +18% · contributors -1 · lines added +40 · AI share +4 pts (previous period partly before the first commit)",
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
        contributors: {
          total: 0,
          active30: 0,
          active90: 0,
          active365: 0,
          allTime: 0,
        },
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
    expect(lines.some((line) => line.startsWith("Stories"))).toBe(true);
    expect(lines.some((line) => line.startsWith("Automation"))).toBe(false);
    expect(lines).toContain("Languages                  no code files");
  });
});

describe("renderAnalysis escaping", () => {
  it("escapes control characters in names that came from git", () => {
    const report = mapTerritories(sampleReport(), (territories) =>
      territories.map((territory) => ({ ...territory, path: "dir\u001B[31m" })),
    );
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
      stories: [
        { kind: "streak" as const, title: "T\u001B[31m", detail: "d\nx" },
      ],
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
    expect(text).toContain("T\\u001b[31m: d\\u000ax");
  });

  it("bolds the headline and labels only when styled", () => {
    const styled = renderAnalysis(sampleReport(), makeStyle(true));

    expect(styled).toContain("\u001B[1mcodesaga · aurora-web");
    expect(styled).toContain("\u001B[1mAutomation");
  });
});
