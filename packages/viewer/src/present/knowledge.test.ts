import { describe, expect, it } from "vitest";

import { sampleReport } from "../testing/reports.js";
import {
  coverageSentence,
  directoryBadges,
  expertLine,
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
