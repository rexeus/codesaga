import type { Report } from "@codesaga/engine";
import { describe, expect, it } from "vitest";

import { sampleReport } from "../testing/reports.js";
import { storyCards } from "./stories.js";

type Story = Report["stories"][number];

const cardFor = (story: Story, report = sampleReport()) => {
  const [card] = storyCards({ ...report, stories: [story] });
  if (card === undefined) {
    throw new Error("expected a card");
  }
  return card;
};

describe("storyCards", () => {
  it("makes a card per story of the report, in its order, and none without stories", () => {
    const report = sampleReport();

    expect(storyCards(report).map(({ kind }) => kind)).toEqual(
      report.stories.map(({ kind }) => kind),
    );
    expect(storyCards({ ...report, stories: [] })).toEqual([]);
  });

  it("sets the facts of the sentence strong: its path, its date and quoted phrases", () => {
    const card = cardFor({
      kind: "biggest-cleanup",
      title: "Biggest cleanup",
      detail: 'On 2025-06-24 "Drop checkout" removed 4,120 lines of src/old.',
      value: 4120,
      date: "2025-06-24",
      path: "src/old",
    });

    expect(
      card.text.filter(({ strong }) => strong).map(({ text }) => text),
    ).toEqual(["2025-06-24", '"Drop checkout"', "src/old"]);
    expect(card.text.map(({ text }) => text).join("")).toBe(
      'On 2025-06-24 "Drop checkout" removed 4,120 lines of src/old.',
    );
  });

  it("sets nothing strong for the root path or an empty one", () => {
    const sentence = "Everything under the repository root is quiet. Truly.";
    const textOf = (path: string) =>
      cardFor({
        kind: "quiet-territory",
        title: "Quiet corner",
        detail: sentence,
        value: 8,
        path,
      }).text;

    expect(textOf(".")).toEqual([{ text: sentence, strong: false }]);
    expect(textOf("")).toEqual([{ text: sentence, strong: false }]);
  });

  it("does not read a path with regular-expression characters as a pattern", () => {
    const card = cardFor({
      kind: "quiet-territory",
      title: "Quiet corner",
      detail: "apps/(web)+[v2] has not changed since 2026-01-12.",
      value: 8,
      date: "2026-01-12",
      path: "apps/(web)+[v2]",
    });

    expect(card.text[0]).toEqual({ text: "apps/(web)+[v2]", strong: true });
  });
});

describe("the figures of a card", () => {
  it("counts the years of an anniversary and the months beyond them, with a timeline", () => {
    const card = cardFor({
      kind: "anniversary",
      title: "Anniversary",
      detail: "Turned two.",
      value: 2,
      unit: "years",
      date: "2025-10-10",
    });

    // 10 Oct 2023 to 30 Sep 2026 is 1,086 days; the anniversaries lie at 365 and 730
    expect(card).toMatchObject({
      big: "2 years",
      unit: "+ 11 months",
      evidence: "first commit 2023-10-10 · 1,086 days of history",
      icon: "cake",
    });
    expect(card.viz).toMatchObject({ kind: "timeline" });
    expect(card.viz?.kind === "timeline" && card.viz.anniversaries).toEqual([
      365 / 1086,
      730 / 1086,
    ]);
  });

  it("counts the days of a day milestone instead of years", () => {
    const card = cardFor({
      kind: "anniversary",
      title: "Anniversary",
      detail: "...",
      value: 500,
      unit: "days",
      date: "2025-02-23",
    });

    expect(card).toMatchObject({ big: "500", unit: "days old" });
    expect(card.viz).toEqual({
      kind: "timeline",
      anniversaries: [500 / 1086],
    });
  });

  it("ends a streak on its last day and draws a dot per day up to 36", () => {
    const card = cardFor({
      kind: "streak",
      title: "Longest streak",
      detail: "...",
      value: 40,
      date: "2025-03-10",
    });

    expect(card).toMatchObject({
      big: "40",
      unit: "days in a row",
      evidence: "2025-03-10 to 2025-04-18",
      viz: { kind: "dots", count: 36 },
    });
  });
});

describe("the busiest day of a card", () => {
  it("sets the busiest day against the commits of its week, and draws nothing when the week is not in the report", () => {
    const report = sampleReport();
    const busiest: Story = {
      kind: "busiest-day",
      title: "Busiest day",
      detail: "...",
      value: 31,
      date: "2025-02-18",
    };
    const week = { start: "2025-02-17", commits: 45, added: 0, deleted: 0 };
    const withWeek: Report = {
      ...report,
      activity: { ...report.activity, weeks: [week] },
    };
    const without: Report = {
      ...report,
      activity: { ...report.activity, weeks: [] },
    };

    expect(cardFor(busiest, withWeek)).toMatchObject({
      viz: { kind: "share", part: 31, rest: 14 },
      evidence: "2025-02-18 · 45 commits that week",
    });
    expect(cardFor(busiest, without)).toMatchObject({
      viz: null,
      evidence: "2025-02-18",
    });
  });
});

describe("the pictures of a card", () => {
  it("shows hours for night owls and weekdays for weekend work, the share as percent", () => {
    const night = cardFor({
      kind: "night-owls",
      title: "Night owls",
      detail: "...",
      value: 0.134,
    });
    const weekend = cardFor({
      kind: "weekend",
      title: "Weekend",
      detail: "...",
      value: 0.14,
    });

    expect(night).toMatchObject({ big: "13%", unit: "after dark" });
    expect(night.viz?.kind === "bars" && night.viz.bars).toHaveLength(24);
    expect(
      night.viz?.kind === "bars" &&
        night.viz.bars.map(({ on }) => on).filter(Boolean),
    ).toHaveLength(7);
    expect(
      weekend.viz?.kind === "bars" && weekend.viz.bars.map(({ on }) => on),
    ).toEqual([false, false, false, false, false, true, true]);
  });

  it("stacks the newcomers and counts those it does not show", () => {
    const card = cardFor({
      kind: "newcomers",
      title: "Newcomers",
      detail: "...",
      value: 7,
      people: [
        { name: "Sam Okafor", email: "sam@x.dev" },
        { name: "Lina Tawfik", email: "lina@x.dev" },
      ],
    });

    expect(card.big).toBe("7");
    expect(card.unit).toBe("new faces");
    expect(card.viz).toMatchObject({
      kind: "people",
      more: 5,
      people: [{ initials: "SO" }, { initials: "LT" }],
    });
  });
});

describe("the words of a card", () => {
  it("writes a cleanup as net lines removed, and names the territory of a quiet corner", () => {
    const cleanup = cardFor({
      kind: "biggest-cleanup",
      title: "Biggest cleanup",
      detail: "...",
      value: 4120,
      date: "2025-06-24",
    });
    const quiet = cardFor({
      kind: "quiet-territory",
      title: "Quiet corner",
      detail: "...",
      value: 8.4,
      date: "2026-01-12",
      path: "docs/guides",
    });

    expect(cleanup).toMatchObject({
      big: "−4,120",
      unit: "net lines",
      viz: { kind: "pill", text: "24 Jun 2025" },
    });
    expect(quiet).toMatchObject({
      big: "8",
      unit: "months untouched",
      viz: { kind: "path", text: "docs/guides" },
    });
  });
});

describe("the night of a card", () => {
  it("stories the night hours of the report's thresholds", () => {
    const report = sampleReport();
    const early: Report = {
      ...report,
      thresholds: {
        ...report.thresholds,
        stories: {
          ...report.thresholds.stories,
          nightFromHour: 1,
          nightToHour: 6,
        },
      },
    };
    const card = cardFor(
      { kind: "night-owls", title: "Night owls", detail: "...", value: 0.2 },
      early,
    );

    expect(
      card.viz?.kind === "bars" &&
        card.viz.bars.flatMap(({ on }, hour) => (on ? [hour] : [])),
    ).toEqual([1, 2, 3, 4, 5]);
    expect(card.evidence).toBe("commits by hour, 01:00 to 06:00 highlighted");
  });
});
