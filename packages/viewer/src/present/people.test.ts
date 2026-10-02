import { describe, expect, it } from "vitest";

import { initialsOf, personEntities } from "./people.js";

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

describe("personEntities", () => {
  const people = Array.from({ length: 9 }, (_, index) => ({
    email: `p${index}@x.dev`,
  }));
  const entityOf = personEntities(people);

  it("gives the first seven contributors a slot each, in the order of the report", () => {
    expect(people.slice(0, 7).map(({ email }) => entityOf(email))).toEqual([
      "slot-1",
      "slot-2",
      "slot-3",
      "slot-4",
      "slot-5",
      "slot-6",
      "slot-7",
    ]);
  });

  it("leaves everyone else, known or not, with the neutral color", () => {
    expect(entityOf("p8@x.dev")).toBe("slot-other");
    expect(entityOf("stranger@x.dev")).toBe("slot-other");
  });
});
