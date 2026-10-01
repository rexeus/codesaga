import { describe, expect, it } from "vitest";

import { describeComparison } from "./comparison-note.js";

const previous = {
  since: "2025-10-15T00:00:00.000Z",
  until: "2026-01-15T00:00:00.000Z",
};

describe("describeComparison", () => {
  it("names the span the window is compared with", () => {
    expect(describeComparison({ ...previous, partial: false })).toBe(
      "compared with 2025-10-15 → 2026-01-15",
    );
  });

  it("notes a span that starts before the first commit", () => {
    expect(describeComparison({ ...previous, partial: true })).toBe(
      "compared with 2025-10-15 → 2026-01-15 (previous period partly before the first commit)",
    );
  });
});
