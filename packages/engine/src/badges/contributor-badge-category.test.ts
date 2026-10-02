import { describe, expect, it } from "vitest";

import { ContributorBadge } from "../report/badges.js";
import { categorized } from "./contributor-badge-category.js";
import type { EarnedContributorBadge } from "./contributor-badge-category.js";

const EXPECTED: Record<ContributorBadge["kind"], string> = {
  "all-rounder": "focus",
  specialist: "focus",
  keeper: "focus",
  tidier: "craft",
  tester: "craft",
  documenter: "craft",
  toolsmith: "craft",
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

const earned = (kind: ContributorBadge["kind"]): EarnedContributorBadge => ({
  kind,
  label: kind,
  evidence: "",
});

describe("categorized", () => {
  it("files every kind of the contract under its category", () => {
    const kinds = ContributorBadge.fields.kind.literals;

    const filed = categorized(kinds.map((kind) => earned(kind)));

    expect(Object.fromEntries(filed.map((b) => [b.kind, b.category]))).toEqual(
      EXPECTED,
    );
  });

  it("orders badges by category, then by the order the rules produced them", () => {
    const filed = categorized([
      earned("steady"),
      earned("weekend-regular"),
      earned("tester"),
      earned("founder"),
      earned("keeper"),
      earned("reviewer"),
      earned("tidier"),
      earned("all-rounder"),
    ]);

    expect(filed.map(({ kind }) => kind)).toStrictEqual([
      "keeper",
      "all-rounder",
      "tester",
      "tidier",
      "weekend-regular",
      "reviewer",
      "steady",
      "founder",
    ]);
  });
});
