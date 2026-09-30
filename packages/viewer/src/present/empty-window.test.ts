import { describe, expect, it } from "vitest";

import { sampleReport } from "../testing/reports.js";
import { emptyWindowNotice } from "./empty-window.js";

describe("emptyWindowNotice", () => {
  const report = sampleReport();

  it("says so when the window has no commits, although the engine emits zero-filled weeks", () => {
    const empty = {
      ...report,
      window: { ...report.window, commits: 0 },
      activity: {
        weeks: [{ start: "2026-01-05", commits: 0, added: 0, deleted: 0 }],
        months: [{ month: "2026-01", commits: 0, contributors: 0 }],
      },
    };

    expect(emptyWindowNotice(empty)).toBe("No commits in the window.");
  });

  it("stays silent when the window has commits", () => {
    expect(emptyWindowNotice(report)).toBeNull();
  });
});
