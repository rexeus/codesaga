import { describe, expect, it } from "vitest";

import { buildIdentities } from "./identities.js";

describe("buildIdentities", () => {
  it("creates one identity per email, ignoring the case of the email", () => {
    const identities = buildIdentities([
      { name: "Ada", email: "Ada@Example.com", time: 1 },
      { name: "Ada", email: "ada@example.com", time: 2 },
    ]);

    expect([...identities.keys()]).toStrictEqual(["ada@example.com"]);
  });

  it("uses the most recent name used with an email as its display name", () => {
    const identities = buildIdentities([
      { name: "Newer Name", email: "a@example.com", time: 20 },
      { name: "Older Name", email: "a@example.com", time: 10 },
    ]);

    expect(identities.get("a@example.com")).toStrictEqual({
      email: "a@example.com",
      name: "Newer Name",
    });
  });

  it("keeps the later entry when two names share a time", () => {
    const identities = buildIdentities([
      { name: "First", email: "a@example.com", time: 5 },
      { name: "Second", email: "a@example.com", time: 5 },
    ]);

    expect(identities.get("a@example.com")?.name).toBe("Second");
  });

  it("keeps two people with the same name and different emails apart", () => {
    const identities = buildIdentities([
      { name: "Alex", email: "alex@one.example", time: 1 },
      { name: "Alex", email: "alex@two.example", time: 2 },
    ]);

    expect(identities.size).toBe(2);
  });

  it("returns no identities for no authorships", () => {
    expect(buildIdentities([]).size).toBe(0);
  });
});
