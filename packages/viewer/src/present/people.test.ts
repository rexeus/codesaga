import { describe, expect, it } from "vitest";

import { initialsOf, slotOf } from "./people.js";

describe("initialsOf", () => {
  it.each([
    ["Lina Tawfik", "LT"],
    ["Mary Jane Watson", "MW"],
    ["lina", "LI"],
    ["Åsa Öberg", "ÅÖ"],
    ["", "?"],
    ["***", "?"],
  ])("writes %s as %s", (name, expected) => {
    expect(initialsOf(name)).toBe(expected);
  });
});

describe("slotOf", () => {
  it("gives a person the same slot every time, within the seven categorical slots", () => {
    const emails = ["a@x.dev", "b@x.dev", "c@x.dev", "d@x.dev", "e@x.dev"];
    const slots = emails.map((email) => slotOf(email));

    expect(slots).toEqual(emails.map((email) => slotOf(email)));
    expect(slots.every((slot) => slot >= 1 && slot <= 7)).toBe(true);
    expect(new Set(slots).size).toBeGreaterThan(1);
  });
});
