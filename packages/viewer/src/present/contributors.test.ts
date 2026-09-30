import { describe, expect, it } from "vitest";

import { sampleReport } from "../testing/reports.js";
import {
  areaLabel,
  naturalDirection,
  sortContributors,
} from "./contributors.js";
import { nextSort } from "./sort-state.js";

const contributors = sampleReport().contributors;
const firstNames = (rows: readonly { name: string }[]): string[] =>
  rows.map(({ name }) => name.split(" ")[0] ?? "");

describe("sortContributors", () => {
  it("sorts numbers, largest first when descending", () => {
    const sorted = sortContributors(contributors, {
      key: "activeDays",
      direction: "desc",
    });

    expect(firstNames(sorted)).toEqual([
      "Maya",
      "Tomás",
      "Priya",
      "Jonas",
      "Aiko",
      "Sam",
      "Lena",
      "Dmitri",
    ]);
  });

  it("sorts dates by time, oldest first when ascending", () => {
    const sorted = sortContributors(contributors, {
      key: "firstCommitAt",
      direction: "asc",
    });

    expect(firstNames(sorted)).toEqual([
      "Maya",
      "Tomás",
      "Dmitri",
      "Priya",
      "Lena",
      "Jonas",
      "Aiko",
      "Sam",
    ]);
  });

  it("sorts names without regard to case", () => {
    const [base] = contributors;
    if (base === undefined) {
      throw new Error("the sample has contributors");
    }
    const rows = [
      { ...base, name: "bob", email: "b@x" },
      { ...base, name: "Alice", email: "a@x" },
      { ...base, name: "carol", email: "c@x" },
    ];

    const sorted = sortContributors(rows, { key: "name", direction: "asc" });

    expect(firstNames(sorted)).toEqual(["Alice", "bob", "carol"]);
  });
});

describe("sortContributors ties and status", () => {
  it("puts active contributors first when descending and keeps the report order among equals", () => {
    const sorted = sortContributors(contributors, {
      key: "active",
      direction: "desc",
    });

    expect(sorted.map(({ active }) => active)).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
      false,
      false,
    ]);
    expect(firstNames(sorted).slice(0, 2)).toEqual(["Maya", "Tomás"]);
    expect(firstNames(sorted).slice(6)).toEqual(["Lena", "Dmitri"]);
  });

  it("leaves the order alone for a key that is not a column", () => {
    const sorted = sortContributors(contributors, {
      key: "unknown",
      direction: "asc",
    });

    expect(sorted).toEqual(contributors);
  });
});

describe("nextSort", () => {
  it("starts another column in its natural direction", () => {
    const from = { key: "commits", direction: "desc" } as const;

    expect(nextSort(from, "name", naturalDirection("name"))).toEqual({
      key: "name",
      direction: "asc",
    });
    expect(nextSort(from, "added", naturalDirection("added"))).toEqual({
      key: "added",
      direction: "desc",
    });
  });

  it("flips the direction of the sorted column", () => {
    const from = { key: "commits", direction: "desc" } as const;

    expect(nextSort(from, "commits", "desc").direction).toBe("asc");
  });
});

describe("areaLabel", () => {
  it("names the engine's dot the repository root and keeps other paths", () => {
    expect(areaLabel(".")).toBe("repository root");
    expect(areaLabel("packages/engine")).toBe("packages/engine");
  });
});
