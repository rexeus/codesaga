import type { Report } from "@codesaga/engine";
import { describe, expect, it } from "vitest";

import { territoryBadges, contributorBadges } from "./badges.js";
import { ICON_NAMES } from "./icons.js";

type ContributorBadge = Report["contributors"][number]["badges"][number];

/** The tone every kind of the contract is drawn in; the type makes a missing kind a compile error. */
const TONE_OF: Record<ContributorBadge["kind"], ContributorBadge["category"]> =
  {
    "all-rounder": "focus",
    specialist: "focus",
    keeper: "focus",
    tidier: "craft",
    tester: "craft",
    documenter: "craft",
    toolsmith: "craft",
    "type-tightener": "craft",
    sweeper: "craft",
    simplifier: "craft",
    "test-companion": "craft",
    "night-owl": "rhythm",
    "early-bird": "rhythm",
    "weekend-regular": "rhythm",
    "pair-partner": "collaboration",
    reviewer: "collaboration",
    founder: "journey",
    "long-hauler": "journey",
    explorer: "journey",
    steady: "journey",
    "new-here": "journey",
    "back-again": "journey",
  };

const KINDS = [
  "all-rounder",
  "specialist",
  "keeper",
  "tidier",
  "tester",
  "documenter",
  "toolsmith",
  "type-tightener",
  "sweeper",
  "simplifier",
  "test-companion",
  "night-owl",
  "early-bird",
  "weekend-regular",
  "pair-partner",
  "reviewer",
  "founder",
  "long-hauler",
  "explorer",
  "steady",
  "new-here",
  "back-again",
] as const satisfies ReadonlyArray<ContributorBadge["kind"]>;

const badge = <Kind extends string>(
  kind: Kind,
  label: string = kind,
  category: "knowledge" | "code" | "activity" = "knowledge",
) => ({
  kind,
  category,
  label,
  evidence: `${label} because of the numbers`,
});

describe("territoryBadges", () => {
  it("shows up to three badges in the order of the report, with their rule as evidence", () => {
    const row = territoryBadges([
      badge("orphaned", "Orphaned"),
      badge("island", "Knowledge island"),
    ]);

    expect(row.more).toBeNull();
    expect(row.chips).toEqual([
      {
        icon: "ghost",
        tone: "crit",
        label: "Orphaned",
        evidence: "Orphaned because of the numbers",
      },
      {
        icon: "tree-palm",
        tone: "warn",
        label: "Knowledge island",
        evidence: "Knowledge island because of the numbers",
      },
    ]);
  });

  it("tints a badge by its category, and only the three risks keep a warning color", () => {
    const row = territoryBadges([
      badge("shared-knowledge", "Shared knowledge", "knowledge"),
      badge("hotspot", "Hotspot", "code"),
      badge("quiet", "Quiet", "activity"),
      badge("one-expert", "One expert", "knowledge"),
      badge("knowledge-fading", "Knowledge fading", "knowledge"),
    ]);

    expect(row.all.map(({ label, tone }) => [label, tone])).toEqual([
      ["Shared knowledge", "knowledge"],
      ["Hotspot", "code"],
      ["Quiet", "activity"],
      ["One expert", "knowledge"],
      ["Knowledge fading", "warn"],
    ]);
  });

  it("folds the badges beyond the third into a count that names them, and keeps every one in `all`", () => {
    const row = territoryBadges([
      badge("orphaned", "Orphaned"),
      badge("island", "Island"),
      badge("quiet", "Quiet"),
      badge("new-territory", "New territory"),
      badge("well-tested", "Well tested"),
    ]);

    expect(row.chips.map(({ label }) => label)).toEqual([
      "Orphaned",
      "Island",
      "Quiet",
    ]);
    expect(row.more).toEqual({
      count: 2,
      labels: "New territory, Well tested",
    });
    expect(row.all).toHaveLength(5);
  });
});

describe("contributorBadges", () => {
  it("draws each badge with the glyph of its kind and the tone of its category", () => {
    const row = contributorBadges([
      { ...badge("keeper", "Keeper of docs"), category: "focus" },
      { ...badge("new-here", "New here"), category: "journey" },
    ]);

    expect(row.chips.map(({ tone, icon }) => [tone, icon])).toEqual([
      ["focus", "key-round"],
      ["journey", "sparkles"],
    ]);
  });

  it("gives every kind a glyph the page ships and the tone of its category", () => {
    const chips = contributorBadges(
      KINDS.map((kind) => ({ ...badge(kind), category: TONE_OF[kind] })),
    ).all;

    expect(KINDS).toHaveLength(Object.keys(TONE_OF).length);
    expect(chips.map(({ tone }) => tone)).toEqual(KINDS.map((k) => TONE_OF[k]));
    expect(chips.every(({ icon }) => ICON_NAMES.includes(icon))).toBe(true);
    expect(new Set(chips.map(({ icon }) => icon)).size).toBe(KINDS.length);
  });

  it("has an empty row without badges", () => {
    expect(contributorBadges([])).toEqual({ chips: [], more: null, all: [] });
  });
});
