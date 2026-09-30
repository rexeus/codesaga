import { describe, expect, it } from "vitest";

import type { ClassifiedCommit } from "../automation/classify.js";
import { at, classifiedCommit } from "../testing/classified-commit.js";
import { contributionsByFile } from "./contributions.js";

const ada = { name: "Ada", email: "ada@example.com" };
const grace = { name: "Grace", email: "grace@example.com" };
const dependabot = { name: "dependabot[bot]", email: "bot@example.com" };

const touching = (
  time: string,
  added: number,
  overrides: Partial<ClassifiedCommit>,
): ClassifiedCommit =>
  classifiedCommit({
    time: at(time),
    changes: [{ path: "src/a.ts", added, deleted: 0 }],
    ...overrides,
  });

const firstAuthors = (commits: ReadonlyArray<ClassifiedCommit>) =>
  (
    contributionsByFile(commits, new Set(["src/a.ts"])).get("src/a.ts") ?? []
  ).filter(({ firstAuthor }) => firstAuthor);

describe("contributionsByFile", () => {
  it("makes the human who holds a file's oldest commit its first author", () => {
    const first = firstAuthors([
      touching("2026-01-02T00:00:00Z", 5, { author: grace }),
      touching("2026-01-01T00:00:00Z", 10, { author: ada }),
    ]);

    expect(first.map(({ email }) => email)).toStrictEqual(["ada@example.com"]);
  });

  it("has no first author when a bot holds the file's oldest commit", () => {
    const first = firstAuthors([
      touching("2026-01-02T00:00:00Z", 5, { author: ada }),
      touching("2026-01-01T00:00:00Z", 10, {
        author: dependabot,
        class: "bot",
        tool: "dependabot[bot]",
      }),
    ]);

    expect(first).toStrictEqual([]);
  });

  it("has no first author when an agent holds the file's oldest commit", () => {
    const first = firstAuthors([
      touching("2026-01-02T00:00:00Z", 5, { author: ada }),
      touching("2026-01-01T00:00:00Z", 10, {
        author: ada,
        class: "agent",
        tool: "Devin",
      }),
    ]);

    expect(first).toStrictEqual([]);
  });

  it("keeps the creator as first author when a later commit only renames the file", () => {
    const first = firstAuthors([
      touching("2026-01-02T00:00:00Z", 0, { author: grace }),
      touching("2026-01-01T00:00:00Z", 10, { author: ada }),
    ]);

    expect(first.map(({ email }) => email)).toStrictEqual(["ada@example.com"]);
  });
});
