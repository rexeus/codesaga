import type { Report } from "@codesaga/engine";
import { describe, expect, it } from "vitest";

import { sampleReport } from "../testing/reports.js";
import { filterOptions, personRows, rowsWithFilter } from "./contributors.js";

const withPeople = (
  people: readonly Partial<Report["contributors"][number]>[],
): Report => {
  const report = sampleReport();
  const [template] = report.contributors;
  if (template === undefined) {
    throw new Error("the sample has contributors");
  }
  return {
    ...report,
    contributors: people.map((person, index) => ({
      ...template,
      email: `p${index}@x.dev`,
      ...person,
    })),
  };
};

describe("the order of personRows", () => {
  it("lists active people first, then new, then dormant, by days with a commit and name", () => {
    const report = withPeople([
      { name: "Zed", status: "dormant", activeDays: 900 },
      { name: "Bea", status: "active", activeDays: 10 },
      { name: "Abe", status: "active", activeDays: 10 },
      { name: "Cal", status: "new", activeDays: 99 },
      { name: "Dan", status: "active", activeDays: 50 },
    ]);

    expect(personRows(report).map(({ name }) => name)).toEqual([
      "Dan",
      "Abe",
      "Bea",
      "Cal",
      "Zed",
    ]);
  });
});

describe("personRows", () => {
  it("writes the line under the name, the folder chips and the last commit", () => {
    const [row] = personRows(
      withPeople([
        {
          name: "Maya Lindqvist",
          commits: 1,
          firstCommitAt: "2025-05-19T08:00:00.000Z",
          lastCommitAt: "2026-08-14T08:00:00.000Z",
          areas: [
            { path: ".", commits: 5 },
            { path: "src/github", commits: 3 },
            { path: "docs", commits: 1 },
          ],
        },
      ]),
    );

    expect(row).toMatchObject({
      initials: "ML",
      since: "since May 2025 · 1 commit",
      folders: ["root", "src/github"],
      moreFolders: 1,
      lastAgo: "7 weeks ago",
      lastDate: "14 Aug 2026",
    });
  });

  it("gives the first seven people of the report their color", () => {
    const rows = personRows(
      withPeople([
        { name: "A", status: "active" },
        { name: "B", status: "dormant" },
      ]),
    );

    expect(rows.map(({ entity }) => entity)).toEqual(["slot-1", "slot-2"]);
  });
});

describe("the status filter", () => {
  const rows = personRows(
    withPeople([
      { name: "A", status: "active", activeDays: 4 },
      { name: "B", status: "new", activeDays: 3 },
      { name: "C", status: "new", activeDays: 2 },
      { name: "D", status: "dormant", activeDays: 1 },
    ]),
  );

  it("counts the new people as active, like the key figure, and shows New and Dormant apart", () => {
    expect(
      filterOptions(rows).map(({ label, count }) => [label, count]),
    ).toEqual([
      ["All", 4],
      ["Active", 3],
      ["New", 2],
      ["Dormant", 1],
    ]);
  });

  it("offers only the statuses somebody has", () => {
    expect(
      filterOptions(rows.filter(({ status }) => status !== "new")).map(
        ({ label }) => label,
      ),
    ).toEqual(["All", "Active", "Dormant"]);
  });

  it("offers no filter for fewer than two people", () => {
    expect(filterOptions(rows.slice(0, 1))).toEqual([]);
  });

  it("lets through the people of a status, in list order", () => {
    expect(rowsWithFilter(rows, "active").map(({ name }) => name)).toEqual([
      "A",
      "B",
      "C",
    ]);
    expect(rowsWithFilter(rows, "new").map(({ name }) => name)).toEqual([
      "B",
      "C",
    ]);
    expect(rowsWithFilter(rows, "all")).toHaveLength(4);
  });
});

describe("the badges of a solo repository", () => {
  const badges = [
    {
      kind: "keeper",
      category: "focus",
      label: "Keeper of src",
      evidence: "only expert",
    },
    {
      kind: "all-rounder",
      category: "focus",
      label: "All-rounder",
      evidence: "all territories",
    },
    {
      kind: "steady",
      category: "journey",
      label: "Steady",
      evidence: "every month",
    },
  ] as const;

  const rowOf = (allTime: number) => {
    const report = withPeople([{ badges: [...badges] }]);
    const [row] = personRows({
      ...report,
      overview: {
        ...report.overview,
        contributors: { ...report.overview.contributors, allTime },
      },
    });
    return row?.badges.chips.map(({ label }) => label);
  };

  it("hides keeper and all-rounder when one person did everything", () => {
    expect(rowOf(1)).toEqual(["Steady"]);
  });

  it("keeps them in a team", () => {
    expect(rowOf(8)).toEqual(["Keeper of src", "All-rounder", "Steady"]);
  });
});
