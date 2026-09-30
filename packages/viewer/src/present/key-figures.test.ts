import { describe, expect, it } from "vitest";

import { sampleReport } from "../testing/reports.js";
import { keyFigures } from "./key-figures.js";

const valuesByLabel = (report = sampleReport()): Record<string, string> =>
  Object.fromEntries(keyFigures(report).map((f) => [f.label, f.value]));

describe("keyFigures", () => {
  it("reads every tile from the report", () => {
    expect(valuesByLabel()).toEqual({
      Age: "2y 11m",
      Commits: "2,246",
      "Active contributors": "3",
      "Truck factor": "2",
      // (203 agent-assisted + 111 agent) of 2246 commits
      "AI share": "14%",
      "Lines of code": "60,942",
    });
  });

  it("shows a dash instead of a share or age it cannot compute", () => {
    const report = sampleReport();
    const empty = {
      ...report,
      repository: { ...report.repository, firstCommitAt: null },
      window: { ...report.window, commits: 0 },
    };

    const values = valuesByLabel(empty);

    expect(values["Age"]).toBe("–");
    expect(values["AI share"]).toBe("–");
  });
});
