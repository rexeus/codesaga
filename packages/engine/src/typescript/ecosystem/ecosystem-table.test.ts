import { describe, expect, it } from "vitest";

import { ECOSYSTEM_TABLE } from "./ecosystem-table.js";

describe("ECOSYSTEM_TABLE", () => {
  it("names every tool once and gives each at least one package", () => {
    const names = ECOSYSTEM_TABLE.map(({ name }) => name);

    expect(new Set(names).size).toBe(names.length);
    for (const entry of ECOSYSTEM_TABLE) {
      expect(entry.packages.length).toBeGreaterThan(0);
    }
  });

  it("writes every package as a name, a scope wildcard or a prefixed built-in, and gives no package to two tools", () => {
    const packages = ECOSYSTEM_TABLE.flatMap(({ packages: names }) => names);

    expect(new Set(packages).size).toBe(packages.length);
    for (const name of packages) {
      expect(name).toMatch(
        /^(?:(?:node|bun):[a-z]+|(?:@[a-z0-9-]+\/(?:\*|[a-z0-9.-]+)|[a-z0-9][a-z0-9.-]*))$/u,
      );
    }
  });
});
