// Owns telling test files, documentation and tooling from other paths, for the badges and stories that read what a commit changed.
// Judged by the path alone, so a file that no longer exists is classified like one that does.
import { matchesAny } from "./globs.js";

// Test directories and test-support directories at any depth, and the test file names of the common ecosystems.
// The support names are the established ones only: `testing/` (Angular, Go), `test-utils/` and `test-helpers/` (Testing Library, many monorepos), and Jest's `__mocks__/` and `__fixtures__/`.
// Plain `fixtures/`, `mocks/` and `testdata/` stay out: applications keep sample data and real stubs there, and the path alone cannot tell.
const TEST_PATH_PATTERNS = [
  "**/test/**",
  "**/tests/**",
  "**/__tests__/**",
  "**/spec/**",
  "**/testing/**",
  "**/test-utils/**",
  "**/test-helpers/**",
  "**/__mocks__/**",
  "**/__fixtures__/**",
  "**/*.test.*",
  "**/*.spec.*",
  "**/*_test.go",
  "**/test_*.py",
  "**/*_test.py",
];

// Documentation directories at any depth and prose file formats.
const DOC_PATH_PATTERNS = [
  "**/docs/**",
  "**/doc/**",
  "**/*.md",
  "**/*.mdx",
  "**/*.rst",
  "**/*.adoc",
  "**/README*",
];

// Release metadata is prose in a docs-looking file format but written by release tooling, not documented by a person.
// Matched on the lowercased path, so `CHANGELOG.md` and `changelog.md` are alike.
const RELEASE_METADATA_PATTERNS = [
  "**/.changeset/**",
  "**/changelog*",
  "**/changes*",
  "**/history*",
  "**/release*",
];

// Tools whose `<tool>.config.<extension>` file is configuration. A bare `*.config.*` would also match application code such as `app.config.ts`.
const CONFIGURED_TOOLS = [
  "vite",
  "vitest",
  "next",
  "nuxt",
  "astro",
  "svelte",
  "webpack",
  "rollup",
  "rolldown",
  "tsup",
  "tsdown",
  "esbuild",
  "eslint",
  "prettier",
  "jest",
  "playwright",
  "cypress",
  "tailwind",
  "postcss",
  "babel",
  "commitlint",
  "lint-staged",
  "turbo",
  "knip",
  "drizzle",
  "vue",
  "remix",
  "metro",
  "storybook",
  "oxlint",
  "oxfmt",
  "biome",
  "stylelint",
  "docusaurus",
  "gatsby",
  "capacitor",
  "wrangler",
];

// Files that build, ship or configure the project rather than being the project: CI, containers, manifests and lockfiles, tool configuration.
// Matched at any depth, so a package of a monorepo counts like the root.
const TOOLING_PATH_PATTERNS = [
  "**/.github/**",
  "**/.gitlab-ci.yml",
  "**/.circleci/**",
  "**/Dockerfile*",
  "**/package.json",
  "**/pnpm-lock.yaml",
  "**/package-lock.json",
  "**/yarn.lock",
  "**/bun.lock*",
  `**/{${CONFIGURED_TOOLS.join(",")}}.config.{js,cjs,mjs,ts,cts,mts,json}`,
  "**/.babelrc*",
  "**/.commitlintrc*",
  "**/.lintstagedrc*",
  "**/.stylelintrc*",
  "**/tsconfig*.json",
  "**/turbo.json",
  "**/.oxlintrc.json",
  "**/.eslintrc*",
  "**/.prettierrc*",
  "**/biome.json",
  "**/renovate.json",
  "**/.changeset/config.json",
];

const isReleaseMetadata = matchesAny(RELEASE_METADATA_PATTERNS);
const isDocumentation = matchesAny(DOC_PATH_PATTERNS);

/**
 * Whether a repository-relative path is a test file or test support: inside a
 * `test`, `tests`, `__tests__`, `spec`, `testing`, `test-utils`,
 * `test-helpers`, `__mocks__` or `__fixtures__` directory at any depth, named
 * `*.test.*`, `*.spec.*`, `*_test.go`, `test_*.py` or `*_test.py`. `fixtures/`,
 * `mocks/` and `testdata/` are not, since production code and sample data live
 * under those names too.
 */
export const isTestPath: (path: string) => boolean =
  matchesAny(TEST_PATH_PATTERNS);

/**
 * Whether a repository-relative path is documentation written by a person.
 * Release metadata is not: `.changeset/**` and files named `CHANGELOG*`,
 * `CHANGES*`, `HISTORY*`, `RELEASE*` and `RELEASES*` in any directory, in any
 * letter case.
 */
export const isDocPath = (path: string): boolean =>
  isDocumentation(path) && !isReleaseMetadata(path.toLowerCase());

/**
 * Whether a repository-relative path is tooling: CI configuration
 * (`.github/**`, `.gitlab-ci.yml`, `.circleci/**`), a `Dockerfile*`, a package
 * manifest or lockfile (`package.json`, `pnpm-lock.yaml`, `package-lock.json`,
 * `yarn.lock`, `bun.lock*`) or tool configuration (`<tool>.config.<extension>`
 * of a known tool such as `vite` or `eslint`, never `app.config.ts`;
 * `tsconfig*.json`, `turbo.json`, `.oxlintrc.json`, `.eslintrc*`,
 * `.prettierrc*`, `biome.json`, `renovate.json`, `.changeset/config.json`),
 * in any directory.
 */
export const isToolingPath: (path: string) => boolean = matchesAny(
  TOOLING_PATH_PATTERNS,
);
