import { describe, expect, it } from "vitest";

import { declaredTypeScript } from "./typescript-version.js";

const manifest = (section: string, version: string): string =>
  JSON.stringify({ [section]: { typescript: version } });

describe("declaredTypeScript", () => {
  it("reads the range and its major from the root manifest", () => {
    expect(
      declaredTypeScript(manifest("devDependencies", "^5.9.2"), [], undefined),
    ).toStrictEqual({ declared: "^5.9.2", majors: [5] });
    expect(
      declaredTypeScript(
        manifest("dependencies", "~6.0.0-beta"),
        [],
        undefined,
      ),
    ).toStrictEqual({ declared: "~6.0.0-beta", majors: [6] });
  });

  it("names every major of a range and of every workspace manifest, root first, each range once", () => {
    expect(
      declaredTypeScript(
        manifest("devDependencies", "^5.9 || ^6.0"),
        ["^5.9 || ^6.0", "~5.4.0", "^7.0.0"],
        undefined,
      ),
    ).toStrictEqual({
      declared: "^5.9 || ^6.0, ~5.4.0, ^7.0.0",
      majors: [5, 6, 7],
    });
  });

  it("finds TypeScript in the workspace manifests when the root declares none", () => {
    expect(
      declaredTypeScript('{ "name": "root" }', ["^6.0.2"], undefined),
    ).toStrictEqual({ declared: "^6.0.2", majors: [6] });
  });
});

describe("declaredTypeScript catalogs", () => {
  it("resolves the default catalog and a named catalog of pnpm-workspace.yaml, in manifests too", () => {
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
      declaredTypeScript(manifest("devDependencies", "catalog:"), [], yaml),
    ).toStrictEqual({ declared: "^5.8.0", majors: [5] });
    expect(
      declaredTypeScript(undefined, ["catalog:", "catalog:next"], yaml),
    ).toStrictEqual({ declared: "^5.8.0, ^6.0.0", majors: [5, 6] });
  });

  it("declares nothing for a catalog it cannot read, a missing manifest or no typescript", () => {
    const none = { declared: null, majors: [] };

    expect(
      declaredTypeScript(
        manifest("devDependencies", "catalog:"),
        [],
        undefined,
      ),
    ).toStrictEqual(none);
    expect(declaredTypeScript(undefined, [], undefined)).toStrictEqual(none);
    expect(
      declaredTypeScript('{"devDependencies": {"vite": "^6"}}', [], undefined),
    ).toStrictEqual(none);
  });

  it("keeps a tag as the declared text without a major", () => {
    expect(
      declaredTypeScript(manifest("devDependencies", "latest"), [], undefined),
    ).toStrictEqual({ declared: "latest", majors: [] });
  });
});
