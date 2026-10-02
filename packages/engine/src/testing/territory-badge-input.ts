import type {
  CodeFacts,
  TerritoryBadgeInput,
} from "../badges/territory-badge-facts.js";
// Tests only: a territory that earns no badge, to vary one fact at a time.
import { at } from "./classified-commit.js";

const nowSeconds = at("2026-07-01T00:00:00Z");

/** The time `days` before 2026-07-01T00:00:00Z, in seconds. */
export const daysAgo = (days: number): number => nowSeconds - days * 86_400;

/** An expert who first committed 2000 days ago and last yesterday, active. */
export const expert = (
  overrides: Partial<TerritoryBadgeInput["experts"][number]> = {},
) => ({
  files: 5,
  soleFiles: 0,
  firstTime: daysAgo(2000),
  lastTime: daysAgo(1),
  ...overrides,
});

/** A repository of 100 files with 10,000 code lines, a median file of 100 lines revised twice, and 0.5 levels per line. */
export const repositoryCode: CodeFacts = {
  files: 100,
  codeLines: 10_000,
  medianFileLines: 100,
  medianRevisions: 2,
  revisionLines: 20_000,
  complexityPerLine: 0.5,
};

/** A territory that earns no badge: ten source files, two active experts, old, changed yesterday, an unremarkable tenth of the code, one of ten siblings. */
export const quietTerritory = (
  overrides: Partial<TerritoryBadgeInput> = {},
): TerritoryBadgeInput => ({
  kind: "package",
  path: "packages/a",
  paths: Array.from({ length: 10 }, (_, i) => `packages/a/src/f${i}.ts`),
  truckFactor: 2,
  island: false,
  orphaned: false,
  experts: [expert(), expert()],
  code: {
    files: 10,
    codeLines: 1_000,
    medianFileLines: 100,
    medianRevisions: 2,
    revisionLines: 2_000,
    complexityPerLine: 0.5,
  },
  repository: repositoryCode,
  siblings: { count: 10, codeLines: 10_000, revisionLines: 20_000 },
  fileFirstCommits: [daysAgo(2000), daysAgo(1500)],
  lastChangeTime: daysAgo(1),
  recentCommits: 0,
  peerRecentCommits: 0,
  startTime: 0,
  firstCommits: [],
  ...overrides,
});
