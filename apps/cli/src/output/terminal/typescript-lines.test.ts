import type { Report } from "@codesaga/engine";
import { describe, expect, it } from "vitest";

import { sampleReport } from "../../testing/sample-report.js";
import { renderAnalysis } from "./analysis-view.js";
import { makeStyle } from "./style.js";
import { typescriptLines } from "./typescript-lines.js";

const plain = makeStyle(false);

type DeepDives = NonNullable<Report["deepDives"]>;

type Ecosystem = NonNullable<NonNullable<DeepDives["typescript"]>["ecosystem"]>;

/** An ecosystem that names no tool. */
const ECOSYSTEM: Ecosystem = {
  tools: [],
  packages: [],
  undeclared: 0,
  nodeBuiltins: [],
  dependencies: { manifests: 0, runtime: 0, dev: 0 },
  hooks: { calls: 0, files: 0 },
};

/** The sample report with `change` applied to its TypeScript deep dive. */
const withTypeScript = (
  change: (
    typescript: NonNullable<DeepDives["typescript"]>,
  ) => NonNullable<DeepDives["typescript"]>,
): Report => {
  const report = sampleReport();
  const typescript = report.deepDives?.typescript;
  if (typescript === undefined) {
    throw new Error("the sample has a TypeScript deep dive");
  }
  return { ...report, deepDives: { typescript: change(typescript) } };
};

describe("typescriptLines", () => {
  it("is at most 8 lines, the first behind the label", () => {
    const lines = typescriptLines(sampleReport(), plain);

    expect(lines).toHaveLength(8);
    expect(lines[0]).toBe(
      "Deep dive: TypeScript      338 files parsed · 5 declaration files · 2 skipped",
    );
  });

  it("is left out of the view for a report without the deep dive", () => {
    const { deepDives: _left, ...report } = sampleReport();

    expect(typescriptLines(report, plain)).toStrictEqual([]);
    expect(renderAnalysis(report, plain)).not.toContain("Deep dive");
  });

  it("says that the parser is unavailable, in the parser's words escaped, and nothing more", () => {
    const report = withTypeScript(({ coverage }) => ({
      coverage: {
        ...coverage,
        parsed: 0,
        unavailable: "no binding\u001B[2J",
      },
    }));

    expect(typescriptLines(report, plain)).toStrictEqual([
      "Deep dive: TypeScript      parser unavailable: no binding\\u001b[2J",
    ]);
  });

  it("names the tools escaped and leaves out those that only check or build", () => {
    const report = withTypeScript((typescript) => ({
      ...typescript,
      ecosystem: {
        ...ECOSYSTEM,
        tools: [
          {
            name: "Evil\u001B[31m",
            category: "framework",
            files: 3,
            declaredIn: 1,
          },
          { name: "ESLint", category: "lint", files: 9, declaredIn: 1 },
        ],
      },
    }));

    const lines = typescriptLines(report, plain);

    expect(lines.some((line) => line.endsWith("Evil\\u001b[31m"))).toBe(true);
    expect(lines.join("\n")).not.toContain("ESLint");
  });

  it("shows the blocks that exist and no line for one that does not", () => {
    const report = withTypeScript(({ coverage }) => ({ coverage }));

    expect(typescriptLines(report, plain)).toStrictEqual([
      "Deep dive: TypeScript      338 files parsed · 5 declaration files · 2 skipped",
    ]);
  });
});

describe("the stories of the TypeScript code in the view", () => {
  it("names a focused test file with its control characters escaped", () => {
    const report = {
      ...sampleReport(),
      stories: [
        {
          kind: "focused-test" as const,
          title: "Focused test",
          detail:
            "1 focused test committed in a\u001B[31m.test.ts: the runner skips every other test while one stays.",
          value: 1,
          path: "a\u001B[31m.test.ts",
        },
      ],
    };

    const line = renderAnalysis(report, plain)
      .split("\n")
      .find((text) => text.startsWith("Stories"));

    expect(line).toBe(
      "Stories                    Focused test: 1 focused test committed in a\\u001b[31m.test.ts: the runner skips every other test while one stays.",
    );
  });
});
