import type { Report } from "@codesaga/engine";
import { describe, expect, it } from "vitest";

import { sampleReport } from "../testing/reports.js";
import { chips, lede, navItems } from "./story.js";
import type { Segment } from "./story.js";

const sentence = (segments: readonly Segment[]): string =>
  segments.map(({ text, strong }) => (strong ? `*${text}*` : text)).join("");

const withOverview = (overview: Partial<Report["overview"]>): Report => {
  const report = sampleReport();
  return { ...report, overview: { ...report.overview, ...overview } };
};

describe("lede", () => {
  it("says the language, age, commits and people of the repository", () => {
    expect(sentence(lede(sampleReport()))).toBe(
      "A TypeScript project that is *2 years and 11 months* old: *2,246 commits* from *8 people*, 4 of them active in the last 90 days.",
    );
  });

  it("names the span a narrower window starts at", () => {
    const report = sampleReport();
    const narrow: Report = {
      ...report,
      window: { ...report.window, since: "2026-03-05T00:00:00.000Z" },
    };

    expect(sentence(lede(narrow))).toContain(
      "*2,246 commits* since 5 Mar 2026 from",
    );
  });

  it("tells a solo repository by its lines instead of its people", () => {
    const solo = withOverview({
      contributors: {
        total: 1,
        active30: 1,
        active90: 1,
        active365: 1,
        allTime: 1,
      },
    });

    expect(sentence(lede(solo))).toContain(
      " from a single author, *60,942 lines* in 473 files.",
    );
  });

  it("says none when nobody was active lately", () => {
    const quiet = withOverview({
      contributors: {
        total: 5,
        active30: 0,
        active90: 0,
        active365: 2,
        allTime: 8,
      },
    });

    expect(sentence(lede(quiet))).toContain(
      ", none active in the last 90 days.",
    );
  });

  it("does not make up a story for a repository without commits", () => {
    const report = sampleReport();
    const empty: Report = {
      ...report,
      repository: { ...report.repository, firstCommitAt: null },
    };

    expect(sentence(lede(empty))).toBe("A repository without commits yet.");
  });
});

describe("chips", () => {
  it("lists branch, short HEAD, window and weeks of history", () => {
    expect(chips(sampleReport()).map(({ parts }) => sentence(parts))).toEqual([
      "Branch *main*",
      "HEAD *9f3c2b1*",
      "*10 Oct 2023* to *30 Sep 2026*",
      "*156 weeks* of history",
    ]);
  });

  it("leaves out the branch of a detached HEAD", () => {
    const report = sampleReport();
    const detached: Report = {
      ...report,
      repository: { ...report.repository, branch: null },
    };

    expect(chips(detached).map(({ icon }) => icon)).not.toContain("branch");
  });
});

describe("navItems", () => {
  it("links the sections the report has, Highlights only with highlights", () => {
    expect(navItems(sampleReport()).map(({ id }) => id)).toEqual([
      "highlights",
      "activity",
      "knowledge",
      "contributors",
    ]);
    expect(
      navItems({ ...sampleReport(), highlights: [] }).map(({ id }) => id),
    ).not.toContain("highlights");
  });
});

describe("lede of a narrow window", () => {
  it("does not call a repository solo because the window shows one author", () => {
    const narrow = withOverview({
      contributors: {
        total: 1,
        active30: 1,
        active90: 1,
        active365: 1,
        allTime: 8,
      },
    });

    expect(sentence(lede(narrow))).toContain(
      " from *1 person*, active in the last 90 days.",
    );
  });
});
