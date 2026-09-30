import { describe, expect, it } from "vitest";

import { at, classifiedCommit } from "../testing/classified-commit.js";
import { punchcard } from "./punchcard.js";

describe("punchcard", () => {
  it("returns 7 rows of 24 zeros for no commits", () => {
    const card = punchcard([]);

    expect(card).toHaveLength(7);
    expect(card.every((row) => row.length === 24)).toBe(true);
    expect(card.flat().every((count) => count === 0)).toBe(true);
  });

  it("counts a commit at 23:30+02:00 in its local weekday and hour 23", () => {
    // Monday 2026-03-02 23:30 at +02:00, which is 21:30 UTC
    const card = punchcard([
      classifiedCommit({
        time: at("2026-03-02T21:30:00Z"),
        offsetMinutes: 120,
      }),
    ]);

    expect(card[0]?.[23]).toBe(1);
    expect(card.flat().reduce((a, b) => a + b, 0)).toBe(1);
  });

  it("moves a commit across midnight when the author's offset changes its local day", () => {
    // The same instant, Sunday 2026-03-01 23:30 UTC: Monday 00:30 at +01:00
    const time = at("2026-03-01T23:30:00Z");
    const card = punchcard([
      classifiedCommit({ time, offsetMinutes: 0 }),
      classifiedCommit({ time, offsetMinutes: 60 }),
    ]);

    expect(card[6]?.[23]).toBe(1);
    expect(card[0]?.[0]).toBe(1);
  });

  it("counts only human and agent-assisted commits", () => {
    const time = at("2026-03-04T10:15:00Z");
    const card = punchcard([
      classifiedCommit({ time }),
      classifiedCommit({ time, class: "agent-assisted", tool: "Claude Code" }),
      classifiedCommit({ time, class: "bot", tool: "Dependabot" }),
      classifiedCommit({ time, class: "agent", tool: "Jules" }),
    ]);

    // Wednesday is row 2
    expect(card[2]?.[10]).toBe(2);
  });
});
