import { describe, expect, it } from "vitest";

import { sampleReport } from "../testing/reports.js";
import {
  coverageSentence,
  directoryBadges,
  expertLine,
  soleExpertSummary,
  truckFactorPeople,
  truckFactorSentence,
} from "./knowledge.js";

const { knowledge } = sampleReport();
const directory = (path: string) => {
  const found = knowledge.directories.find((entry) => entry.path === path);
  if (found === undefined) {
    throw new Error(`the sample has no ${path}`);
  }
  return found;
};

describe("directoryBadges", () => {
  it.each([
    ["docs", ["Orphaned", "Island"]],
    ["packages/db", ["Orphaned"]],
    ["packages/auth", ["Island"]],
    ["apps/admin", []],
  ])("flags %s as %j", (path, labels) => {
    expect(directoryBadges(directory(path)).map(({ label }) => label)).toEqual(
      labels,
    );
  });
});

describe("expertLine", () => {
  it("marks an inactive expert with the date of their last commit", () => {
    const [lena] = directory("docs").experts;

    expect(lena && expertLine(lena)).toEqual({
      name: "Lena Fischer",
      active: false,
      status: "inactive since 2025-11-14",
      detail: "13 files (93%)",
    });
  });

  it("lists an active expert without a date", () => {
    const maya = directory("docs").experts[1];

    expect(maya && expertLine(maya)).toMatchObject({
      active: true,
      status: "active",
      detail: "2 files (14%)",
    });
  });

  it("says file in the singular", () => {
    const [first] = directory("docs").experts;
    const one = first && expertLine({ ...first, files: 1 });

    expect(one?.detail).toMatch(/^1 file \(/u);
  });
});

describe("truck factor", () => {
  it("lists the people in removal order with their state", () => {
    expect(
      truckFactorPeople(knowledge).map(({ name, status }) => [name, status]),
    ).toEqual([
      ["Maya Lindqvist", "active"],
      ["Tomás Herrera", "active"],
    ]);
  });

  it("explains what it counts", () => {
    expect(truckFactorSentence(knowledge)).toBe(
      "If these 2 people leave, more than half of the 473 files have no expert.",
    );
    expect(
      truckFactorSentence({
        ...knowledge,
        truckFactor: { value: 1, people: [] },
      }),
    ).toBe(
      "If this person leaves, more than half of the 473 files have no expert.",
    );
    expect(
      truckFactorSentence({
        ...knowledge,
        truckFactor: { value: 0, people: [] },
      }),
    ).toBe("More than half of the files already have no expert.");
  });

  it("states how many files lack an expert", () => {
    expect(coverageSentence(knowledge)).toBe(
      "27 of 473 files have no expert; 81 have no active expert.",
    );
  });
});

describe("soleExpertSummary", () => {
  const [found] = directory("docs").experts;
  if (found === undefined) {
    throw new Error("the sample's docs directory has no expert");
  }
  const lena = found;
  const alone = (path: string, experts: readonly (typeof lena)[] = [lena]) => ({
    ...directory("docs"),
    path,
    experts,
  });
  const summary = (...directories: ReturnType<typeof alone>[]) =>
    soleExpertSummary({ ...knowledge, directories });

  it("names the one expert of every directory", () => {
    const maya = { ...lena, name: "Maya Lindqvist", active: true };
    const byMaya = (path: string) => alone(path, [maya]);

    expect(summary(byMaya("a"), byMaya("b"), byMaya("c"))).toBe(
      "Maya Lindqvist is the only expert in all 3 directories.",
    );
  });

  it("words it for a single directory and says when the expert left", () => {
    expect(summary(alone("a"))).toBe(
      "Lena Fischer (inactive since 2025-11-14) is the only expert in this directory.",
    );
  });

  it("stays silent once a second person or a missing expert appears", () => {
    const other = { ...lena, email: "other@example.com" };

    expect(soleExpertSummary(knowledge)).toBeNull();
    expect(summary(alone("a"), alone("b", []))).toBeNull();
    expect(summary(alone("a"), alone("b", [other]))).toBeNull();
    expect(summary(alone("a", [lena, other]))).toBeNull();
    expect(summary()).toBeNull();
  });
});
