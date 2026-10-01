// Tests only: `analyze` options for a temporary repository, with the defaults tests share.
import type { AnalyzeOptions } from "../analyze/gather.js";
import type { TempRepository } from "./temp-repository.js";

/** Analyzes the whole repository and its whole history unless `overrides` say otherwise. */
export const analyzeOptionsFor = (
  repo: Pick<TempRepository, "directory">,
  overrides: Partial<AnalyzeOptions> = {},
): AnalyzeOptions => ({
  cwd: repo.directory,
  include: [],
  exclude: [],
  toolVersion: "0.0.0-test",
  ...overrides,
});
