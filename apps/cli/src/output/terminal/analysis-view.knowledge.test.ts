import { describe, expect, it } from "vitest";

import { sampleReport } from "../../testing/sample-report.js";
import { renderAnalysis } from "./analysis-view.js";
import { makeStyle } from "./style.js";

const plain = makeStyle(false);

describe("renderAnalysis knowledge", () => {
  it("prints no ANSI codes with plain style and marks an inactive person in the truck factor", () => {
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
      "Truck factor               2 · Maya Lindqvist, Tomás Herrera (inactive)",
    );
    expect(text).not.toContain("\u001B");
  });

  it("says when most files have no expert and omits the directory table without directories", () => {
    const report = sampleReport();
    const lines = renderAnalysis(
      {
        ...report,
        knowledge: {
          ...report.knowledge,
          truckFactor: { value: 0, people: [] },
          directories: [],
        },
      },
      plain,
    ).split("\n");

    expect(lines).toContain(
      "Truck factor               0 · most files have no expert",
    );
    expect(lines.some((line) => line.startsWith("Knowledge risks"))).toBe(
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
      contributors: { total: 1, active30: 1, active90: 1, active365: 1 },
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
    expect(lines.some((line) => line.startsWith("Knowledge risks"))).toBe(
      false,
    );
    expect(lines.some((line) => line.includes("island"))).toBe(false);
  });

  it("marks a sole contributor who is no longer active", () => {
    expect(renderAnalysis(soleAuthor(false), plain)).toContain(
      "one contributor — Dennis Wentzien (inactive) is the only expert everywhere",
    );
  });
});

describe("renderAnalysis line owners", () => {
  it("shows the leading line owner per directory, marking a bot", () => {
    const report = sampleReport();
    const [docs, db, ...rest] = report.knowledge.directories;
    const owner = { email: "a@example.com", kind: "human" } as const;
    const lines = renderAnalysis(
      {
        ...report,
        knowledge: {
          ...report.knowledge,
          directories: [
            Object.assign({}, docs, {
              lineOwners: {
                lines: 200,
                owners: [{ ...owner, name: "Ada", lines: 150, share: 0.75 }],
              },
            }),
            Object.assign({}, db, {
              lineOwners: {
                lines: 3,
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
            }),
            ...rest,
          ],
        },
      },
      plain,
    ).split("\n");
    expect(lines).toContain(
      "Knowledge risks            files  flags             leading expert                leading line owner",
    );
    expect(lines).toContain(
      "  docs                        14  orphaned, island  Lena Fischer 93% (inactive)   Ada 75%",
    );
    expect(lines).toContain(
      "  packages/db                 52  orphaned          Dmitri Volkov 69% (inactive)  dependabot[bot] (bot) 33%",
    );
  });
});
