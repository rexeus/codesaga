import { DateTime } from "effect";
import { describe, expect, it } from "vitest";

import { at } from "../testing/classified-commit.js";
import { contributorStatus } from "./status.js";

const now = DateTime.makeUnsafe("2026-07-01T00:00:00Z");

describe("contributorStatus", () => {
  it("is new when the first commit lies exactly 90 days back", () => {
    // 90 days before 2026-07-01 is 2026-04-02
    expect(
      contributorStatus(
        at("2026-04-02T00:00:00Z"),
        at("2026-06-30T00:00:00Z"),
        at("2020-01-01T00:00:00Z"),
        now,
      ),
    ).toBe("new");
  });

  it("is active when the first commit lies 91 days back", () => {
    expect(
      contributorStatus(
        at("2026-04-01T23:59:59Z"),
        at("2026-06-30T00:00:00Z"),
        at("2020-01-01T00:00:00Z"),
        now,
      ),
    ).toBe("active");
  });

  it("is active with the last commit exactly 183 days back, and dormant one second earlier", () => {
    // 183 days before 2026-07-01 is 2025-12-30
    expect(
      contributorStatus(
        at("2024-01-01T00:00:00Z"),
        at("2025-12-30T00:00:00Z"),
        at("2020-01-01T00:00:00Z"),
        now,
      ),
    ).toBe("active");
    expect(
      contributorStatus(
        at("2024-01-01T00:00:00Z"),
        at("2025-12-29T23:59:59Z"),
        at("2020-01-01T00:00:00Z"),
        now,
      ),
    ).toBe("dormant");
  });
});

describe("contributorStatus founder", () => {
  it("is not new for the one who started the repository, whatever their age", () => {
    const start = at("2026-06-01T00:00:00Z");

    expect(
      contributorStatus(start, at("2026-06-30T00:00:00Z"), start, now),
    ).toBe("active");
    expect(
      contributorStatus(start, at("2026-06-30T00:00:00Z"), start - 1, now),
    ).toBe("new");
  });

  it("is dormant for a founder who left, not new", () => {
    const start = at("2026-04-10T00:00:00Z");

    expect(contributorStatus(start, start, start, now)).toBe("active");
    expect(
      contributorStatus(
        at("2025-01-01T00:00:00Z"),
        at("2025-01-02T00:00:00Z"),
        0,
        now,
      ),
    ).toBe("dormant");
  });
});
