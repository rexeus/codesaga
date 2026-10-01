import { defineConfig } from "vitest/config";

export default defineConfig({
  root: new URL(".", import.meta.url).pathname,
  test: {
    include: ["scripts/**/*.test.ts"],
    passWithNoTests: true,
    // The lint probes spawn type-aware oxlint per case, which takes seconds
    // when turbo runs the package suites in parallel.
    testTimeout: 30_000,
  },
});
