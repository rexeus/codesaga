import { describe, expect, it } from "vitest";

import { sampleDeepDive, sampleReport } from "../testing/reports.js";
import { territoryTypeScript } from "./typescript-territory.js";

const territories = sampleReport().knowledge.territories.territories;
const repository = sampleDeepDive();
const byPath = (path: string) => {
  const territory = territories.find((entry) => entry.path === path);
  if (territory === undefined) {
    throw new TypeError(`The sample has no territory ${path}.`);
  }
  return territory;
};

describe("territoryTypeScript", () => {
  it("words the figures of a territory", () => {
    expect(
      territoryTypeScript(byPath("packages/db"), repository),
    ).toMatchObject({
      size: "38 files · 4,300 lines",
      strict: "strict on",
      esm: "100%",
      complexity: { share: "2.1%", max: "33", counts: "8 of 380" },
      imports: { imports: "0", importedBy: "4" },
      inCycle: false,
    });
  });

  it("holds the escape rate against the repository's on one bar", () => {
    const view = territoryTypeScript(byPath("packages/db"), repository);

    // 4.1 against 4.974 per 1,000 lines, on a bar scaled to 4.974 + 12 %
    expect(view?.escapes?.figure).toBe("4.1");
    expect(view?.escapes?.value).toBeCloseTo(4.1 / (4.974 * 1.12), 6);
    expect(view?.escapes?.reference).toBeCloseTo(1 / 1.12, 6);
  });

  it("says when its files do not agree on strict, or when a config could not be read", () => {
    expect(territoryTypeScript(byPath("apps/admin"), repository)?.strict).toBe(
      "strict mixed",
    );
    expect(
      territoryTypeScript(byPath("packages/auth"), repository)?.strict,
    ).toBe("strict unknown");
  });
});

describe("territoryTypeScript without figures", () => {
  it("has no territory line for a territory without a parsed file", () => {
    expect(territoryTypeScript(byPath("docs"), repository)).toBeNull();
  });

  it("leaves out the figures the territory does not have", () => {
    const territory = byPath("packages/db");
    const view = territoryTypeScript(
      {
        ...territory,
        typescript: {
          files: 2,
          codeLines: 40,
        },
      },
      repository,
    );

    expect(view).toEqual({
      size: "2 files · 40 lines",
      escapes: null,
      strict: null,
      esm: null,
      complexity: null,
      imports: null,
      inCycle: false,
    });
  });

  it("flags a cycle that runs through the territory", () => {
    const territory = byPath("packages/db");
    const view = territoryTypeScript(
      {
        ...territory,
        typescript: { files: 3, codeLines: 90, inCycle: true },
      },
      repository,
    );

    expect(view?.inCycle).toBe(true);
  });

  it("holds the escape rate against itself without a repository figure", () => {
    const view = territoryTypeScript(byPath("packages/db"), undefined);

    expect(view?.escapes?.value).toBeCloseTo(view?.escapes?.reference ?? 0, 6);
  });

  it("leaves out the function counts when the report does not carry them", () => {
    const territory = byPath("packages/db");
    const {
      functions: _,
      complexFunctions: __,
      ...rest
    } = territory.typescript ?? { files: 0, codeLines: 0 };

    const view = territoryTypeScript(
      { ...territory, typescript: rest },
      repository,
    );

    expect(view?.complexity?.counts).toBeNull();
  });
});
