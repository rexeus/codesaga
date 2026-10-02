// Tests only: classified commits for the pure section functions, without git.
import type { ClassifiedCommit } from "../automation/classify.js";

/** Seconds since the epoch of an ISO 8601 timestamp, the unit of commit times. */
export const at = (iso: string): number => Date.parse(iso) / 1000;

/**
 * A human commit by ada@example.com at 2026-01-01T00:00:00Z with no changes;
 * `overrides` replace any field.
 */
export const classifiedCommit = (
  overrides: Partial<ClassifiedCommit> = {},
): ClassifiedCommit => ({
  class: "human",
  tools: [],
  time: at("2026-01-01T00:00:00Z"),
  offsetMinutes: 0,
  subject: "",
  author: { name: "Ada", email: "ada@example.com" },
  humanCoAuthors: 0,
  changes: [],
  ...overrides,
});
