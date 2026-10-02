import { describe, expect, it } from "vitest";

import { mapTerritories, sampleReport } from "../../testing/sample-report.js";
import { renderAnalysis } from "./analysis-view.js";
import { makeStyle } from "./style.js";

const plain = makeStyle(false);

describe("renderAnalysis knowledge", () => {
  it("prints no ANSI codes with plain style and marks an dormant person in the truck factor", () => {
    const report = sampleReport();
    const text = renderAnalysis(
      {
        ...report,
        knowledge: {
          ...report.knowledge,
          truckFactor: {
            value: 2,
            people: report.knowledge.truckFactor.people.map((person, index) =>
              Object.assign({}, person, { active: index === 0 }),
            ),
          },
        },
      },
      plain,
    );

    expect(text).toContain(
      "Truck factor               2 · Maya Lindqvist, Tomás Herrera (dormant)",
    );
    expect(text).not.toContain("\u001B");
  });

  it("says when most files have no expert and omits the territory table without territories", () => {
    const report = mapTerritories(sampleReport(), () => []);
    const lines = renderAnalysis(
      {
        ...report,
        knowledge: {
          ...report.knowledge,
          truckFactor: { value: 0, people: [] },
        },
      },
      plain,
    ).split("\n");

    expect(lines).toContain(
      "Truck factor               0 · most files have no expert",
    );
    expect(lines.some((line) => line.startsWith("Knowledge territories"))).toBe(
      false,
    );
  });
});

describe("renderAnalysis truck factor", () => {
  it("lists a large truck factor as three names and a count", () => {
    const report = sampleReport();
    const [first] = report.knowledge.truckFactor.people;
    const people = Array.from({ length: 20 }, (_, index) =>
      Object.assign({}, first, { name: `Person ${index + 1}` }),
    );
    const lines = renderAnalysis(
      {
        ...report,
        knowledge: {
          ...report.knowledge,
          truckFactor: { value: 20, people },
        },
      },
      plain,
    ).split("\n");

    expect(lines).toContain(
      "Truck factor               20 · Person 1, Person 2, Person 3 and 17 more",
    );
  });

  it("cuts a long name with control characters on whole escapes", () => {
    const report = sampleReport();
    const [first] = report.knowledge.truckFactor.people;
    const name = `${"a".repeat(21)}\u001B[31mred`;
    const lines = renderAnalysis(
      {
        ...report,
        knowledge: {
          ...report.knowledge,
          truckFactor: {
            value: 1,
            people: [Object.assign({}, first, { name })],
          },
        },
      },
      plain,
    ).split("\n");

    expect(lines).toContain(
      `Truck factor               1 · ${"a".repeat(21)}…`,
    );
  });
});

const soleAuthor = (active: boolean) => {
  const report = sampleReport();
  const [first] = report.knowledge.truckFactor.people;
  const person = Object.assign({}, first, {
    name: "Dennis Wentzien",
    active,
  });
  return {
    ...report,
    overview: {
      ...report.overview,
      contributors: {
        total: 1,
        active30: 1,
        active90: 1,
        active365: 1,
        allTime: 1,
      },
    },
    knowledge: {
      ...report.knowledge,
      truckFactor: { value: 1, people: [person] },
    },
  };
};

describe("renderAnalysis in a single-author repository", () => {
  it("says once that one person is the only expert instead of listing islands", () => {
    const lines = renderAnalysis(soleAuthor(true), plain).split("\n");

    expect(lines).toContain(
      "Knowledge                  one contributor — Dennis Wentzien is the only expert everywhere",
    );
    expect(lines.some((line) => line.startsWith("Truck factor"))).toBe(false);
    expect(lines.some((line) => line.startsWith("Knowledge territories"))).toBe(
      false,
    );
    expect(lines.some((line) => line.includes("island"))).toBe(false);
  });

  it("marks a sole contributor who is no longer active", () => {
    expect(renderAnalysis(soleAuthor(false), plain)).toContain(
      "one contributor — Dennis Wentzien (dormant) is the only expert everywhere",
    );
  });
});

describe("renderAnalysis line owners", () => {
  it("shows the leading line owner per territory, marking a bot", () => {
    const owner = { email: "a@example.com", kind: "human" } as const;
    const report = mapTerritories(sampleReport(), (territories) =>
      territories.map((territory) => {
        if (territory.path === "docs") {
          return {
            ...territory,
            lineOwners: {
              lines: 200,
              skippedFiles: 0,
              owners: [{ ...owner, name: "Ada", lines: 150, share: 0.75 }],
            },
          };
        }
        if (territory.path === "packages/db") {
          return {
            ...territory,
            lineOwners: {
              lines: 3,
              skippedFiles: 0,
              owners: [
                {
                  ...owner,
                  name: "dependabot[bot]",
                  kind: "bot",
                  lines: 1,
                  share: 0.3333,
                },
              ],
            },
          };
        }
        return territory;
      }),
    );
    const lines = renderAnalysis(report, plain).split("\n");

    expect(lines).toContain(
      "Knowledge territories      files  flags             leading expert               leading line owner",
    );
    expect(lines).toContain(
      "  docs                        14  orphaned, island  Lena Fischer 93% (dormant)   Ada 75%",
    );
    expect(lines).toContain(
      "  packages/db                 52  orphaned          Dmitri Volkov 69% (dormant)  dependabot[bot] (bot) 33%",
    );
  });
});

/** The sample report's lines with the territories started at `detail`. */
const atDetail = (detail: number): ReadonlyArray<string> => {
  const report = sampleReport();
  return renderAnalysis(
    {
      ...report,
      knowledge: {
        ...report.knowledge,
        territories: { ...report.knowledge.territories, detail },
      },
    },
    plain,
  ).split("\n");
};

describe("renderAnalysis territories", () => {
  it("shows the first cut at detail 1 and says which detail it is", () => {
    const lines = atDetail(1);

    expect(lines).toContain(
      "  packages/db                 52  orphaned          Dmitri Volkov 69% (dormant)  Dmitri Volkov 67%",
    );
    expect(lines.some((line) => line.includes("migrations"))).toBe(false);
    const note = lines.indexOf(
      "                           Territories at detail 1 of 3 (recommended: 1)",
    );
    expect(lines[note + 1]).toBe(
      "                           detail 1: 11 territories (without other files) for 4 active contributors",
    );
  });

  it("indents the territories a split territory opens into at the chosen detail, other files last", () => {
    const lines = atDetail(2);
    const db = lines.findIndex((line) => line.startsWith("  packages/db "));

    expect(lines.slice(db + 1, db + 4)).toStrictEqual([
      "    migrations                30  orphaned, island  Dmitri Volkov 100% (dormant)",
      "    src                       18                    Tomás Herrera 72%",
      "    other files                4                    Tomás Herrera 100%",
    ]);
  });

  it("shows no more than two levels, however deep the split goes", () => {
    const lines = atDetail(3);

    expect(lines).toContain(
      "    src                       18                    Tomás Herrera 72%",
    );
    expect(lines.some((line) => line.includes("queries"))).toBe(false);
  });

  it("marks the small territories of a directory as its other files", () => {
    const report = mapTerritories(sampleReport(), (territories) =>
      territories.map((territory, index) =>
        index === 0 ? { ...territory, kind: "other", path: "apps" } : territory,
      ),
    );

    expect(renderAnalysis(report, plain).split("\n")).toContain(
      "  apps (other)                14  orphaned, island  Lena Fischer 93% (dormant)   Lena Fischer 86%",
    );
  });
});
