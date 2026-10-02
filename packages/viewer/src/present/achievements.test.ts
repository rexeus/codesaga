import type { Report } from "@codesaga/engine";
import { describe, expect, it } from "vitest";

import { achievementSummary, medals } from "./achievements.js";

type Achievement = Report["achievements"][number];

const achievement = (
  kind: Achievement["kind"],
  overrides: Partial<Achievement> = {},
): Achievement => ({
  kind,
  title: kind,
  reached: false,
  reachedAt: null,
  holds: "milestone",
  detail: "A fact.",
  progress: null,
  ...overrides,
});

describe("medals progress", () => {
  it("lists the reached achievements first, each group in the report's order", () => {
    const listed = medals([
      achievement("first-commits"),
      achievement("marathon", { reached: true }),
      achievement("community"),
      achievement("bus-proof", { reached: true, holds: "state" }),
    ]);

    expect(listed.map(({ kind, reached }) => [kind, reached])).toEqual([
      ["marathon", true],
      ["bus-proof", true],
      ["first-commits", false],
      ["community", false],
    ]);
  });

  it("shows a locked achievement's progress as figures and a bar", () => {
    const [locked] = medals([
      achievement("first-commits", {
        progress: { value: 800, target: 1000, unit: "commits" },
      }),
    ]);

    expect(locked?.progress).toEqual({
      heading: "Not yet",
      figures: "800 / 1,000 commits",
      fraction: 0.8,
    });
    expect(locked?.when).toBeNull();
    expect(locked?.complete).toBe(false);
  });

  it("shows a reached tier with its pips and the next one as progress, until nothing is left", () => {
    const [partly, whole] = medals([
      achievement("first-commits", {
        reached: true,
        tier: 1,
        tiers: [1000, 10000],
        reachedAt: "2026-07-28",
        progress: { value: 3637, target: 10000, unit: "commits" },
      }),
      achievement("community", {
        reached: true,
        tier: 3,
        tiers: [10, 50, 100],
        reachedAt: "2026-06-12",
      }),
    ]);

    expect(partly?.tiers).toEqual({
      total: 2,
      reached: 1,
      caption: "Tier 1 of 2 · 1,000+ commits",
    });
    expect(partly?.progress).toMatchObject({
      heading: "Next: 10,000 commits",
      figures: "3,637 / 10,000",
    });
    expect(partly?.complete).toBe(false);
    expect(whole?.tiers?.caption).toBe("Tier 3 of 3 · 100+ contributors");
    expect(whole?.complete).toBe(true);
  });
});

describe("medals captions", () => {
  it("dates a milestone, says a state holds today, and does not invent a day for a shallow clone", () => {
    const [dated, state, shallow] = medals([
      achievement("marathon", { reached: true, reachedAt: "2023-02-21" }),
      achievement("test-culture", { reached: true, holds: "state" }),
      achievement("unbroken", { reached: true }),
    ]);

    expect(dated?.when).toEqual({
      icon: "calendar-check",
      text: "Reached 21 Feb 2023",
    });
    expect(state?.when).toEqual({ icon: "check", text: "Holds today" });
    expect(shallow?.when).toEqual({ icon: "check", text: "Reached" });
  });

  it("writes the days inside a detail the way people do", () => {
    const [listed] = medals([
      achievement("marathon", {
        detail: "500 days of history since 2025-05-19.",
      }),
    ]);

    expect(listed?.detail).toBe("500 days of history since 19 May 2025.");
  });
});

describe("achievementSummary", () => {
  it("counts the reached and the ones still ahead", () => {
    const some = [
      achievement("marathon", { reached: true }),
      achievement("community"),
      achievement("polyglot"),
    ];

    expect(achievementSummary(some)).toEqual({
      strong: "1 of 3",
      rest: " reached · 2 still ahead",
    });
    expect(
      achievementSummary([achievement("marathon", { reached: true })]).rest,
    ).toBe(" reached");
  });
});
