import { describe, expect, it } from "vitest";

import { isDocPath, isTestPath, isToolingPath } from "./path-kinds.js";

describe("isTestPath", () => {
  it.each([
    "test/a.ts",
    "packages/engine/tests/a.ts",
    "src/__tests__/a.ts",
    "spec/a.rb",
    "src/a.test.ts",
    "src/a.spec.tsx",
    "pkg/a_test.go",
    "pkg/test_a.py",
    "pkg/a_test.py",
    "packages/engine/src/testing/helper.ts",
    "src/testing/nested/deep/factory.ts",
    "src/test-utils/render.tsx",
    "src/test-helpers/db.ts",
    "src/components/__mocks__/api.ts",
    "__fixtures__/user.json",
    "src/__fixtures__/user.ts",
  ])("recognizes %s as a test file", (path) => {
    expect(isTestPath(path)).toBe(true);
  });

  it.each([
    "src/a.ts",
    "src/latest.ts",
    "pkg/a_test.rs",
    "contest/a.ts",
    "src/fixtures/sample.ts",
    "fixtures/report.sample.json",
    "src/mocks/server.ts",
    "pkg/testdata/a.txt",
    "src/testing.ts",
    "src/protesting/a.ts",
    "src/test-utilities/a.ts",
  ])("does not take %s for a test file", (path) => {
    expect(isTestPath(path)).toBe(false);
  });
});

describe("isDocPath", () => {
  it.each([
    "docs/guide.txt",
    "packages/a/doc/x.html",
    "site/page.mdx",
    "notes/a.rst",
    "notes/a.adoc",
    "README",
    "packages/a/README.txt",
  ])("recognizes %s as documentation", (path) => {
    expect(isDocPath(path)).toBe(true);
  });

  it.each([
    "src/a.ts",
    "src/docsify.ts",
    "package.json",
    ".changeset/brave-lions-jump.md",
    "packages/a/.changeset/config.json",
    "CHANGELOG.md",
    "packages/a/changelog.md",
    "CHANGES.rst",
    "HISTORY.md",
    "docs/RELEASE_NOTES.md",
    "RELEASES.md",
  ])("does not take %s for documentation", (path) => {
    expect(isDocPath(path)).toBe(false);
  });

  it("keeps a page inside a releasing directory as documentation", () => {
    expect(isDocPath("docs/releasing/guide.md")).toBe(true);
  });
});

describe("isToolingPath", () => {
  it.each([
    ".github/workflows/ci.yml",
    ".github/dependabot.yml",
    ".gitlab-ci.yml",
    ".circleci/config.yml",
    "Dockerfile",
    "services/api/Dockerfile.dev",
    "package.json",
    "packages/engine/package.json",
    "pnpm-lock.yaml",
    "package-lock.json",
    "yarn.lock",
    "bun.lock",
    "bun.lockb",
    "vite.config.ts",
    "apps/web/next.config.mjs",
    "tsconfig.json",
    "packages/a/tsconfig.build.json",
    "turbo.json",
    "eslint.config.js",
    "packages/web/tailwind.config.cjs",
    "vitest.config.mts",
    ".babelrc",
    ".oxlintrc.json",
    ".eslintrc.cjs",
    ".prettierrc",
    "biome.json",
    "renovate.json",
    ".changeset/config.json",
  ])("recognizes %s as tooling", (path) => {
    expect(isToolingPath(path)).toBe(true);
  });

  it.each([
    "src/a.ts",
    "src/configuration.ts",
    "src/config/defaults.ts",
    "README.md",
    "docs/ci.md",
    ".changeset/brave-lions-jump.md",
    "src/dockerfile-parser.ts",
    "src/package.json.ts",
    "composer.lock",
    "tsconfig.ts",
    "src/app.config.service.ts",
    "src/database.config.ts",
    "app.config.ts",
    "src/vite.config.helpers.ts",
  ])("does not take %s for tooling", (path) => {
    expect(isToolingPath(path)).toBe(false);
  });
});
