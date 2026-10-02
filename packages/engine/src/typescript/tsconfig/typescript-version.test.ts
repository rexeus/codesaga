import { describe, expect, it } from "vitest";

import { declaredTypeScript } from "./typescript-version.js";

const manifest = (section: string, version: string): string =>
  JSON.stringify({ [section]: { typescript: version } });

describe("declaredTypeScript", () => {
  it("reads the range and its major from the root manifest", () => {
    expect(
      declaredTypeScript(manifest("devDependencies", "^5.9.2"), undefined),
    ).toStrictEqual({ declared: "^5.9.2", major: 5 });
    expect(
      declaredTypeScript(manifest("dependencies", "~6.0.0-beta"), undefined),
    ).toStrictEqual({ declared: "~6.0.0-beta", major: 6 });
  });

  it("resolves the default catalog and a named catalog of pnpm-workspace.yaml", () => {
    const yaml = [
      "packages:",
      "  - packages/*",
      "catalog:",
      '  typescript: "^5.8.0"',
      "  vitest: ^3.0.0",
      "catalogs:",
      "  next:",
      "    react: ^19.0.0",
      "    typescript: ^6.0.0",
      "",
    ].join("\n");

    expect(
      declaredTypeScript(manifest("devDependencies", "catalog:"), yaml),
    ).toStrictEqual({ declared: "^5.8.0", major: 5 });
    expect(
      declaredTypeScript(manifest("devDependencies", "catalog:next"), yaml),
    ).toStrictEqual({ declared: "^6.0.0", major: 6 });
  });

  it("declares nothing for a catalog it cannot read, a missing manifest or no typescript", () => {
    const none = { declared: null, major: null };

    expect(
      declaredTypeScript(manifest("devDependencies", "catalog:"), undefined),
    ).toStrictEqual(none);
    expect(declaredTypeScript(undefined, undefined)).toStrictEqual(none);
    expect(
      declaredTypeScript('{"devDependencies": {"vite": "^6"}}', undefined),
    ).toStrictEqual(none);
  });

  it("keeps a tag as the declared text without a major", () => {
    expect(
      declaredTypeScript(manifest("devDependencies", "latest"), undefined),
    ).toStrictEqual({ declared: "latest", major: null });
  });
});
