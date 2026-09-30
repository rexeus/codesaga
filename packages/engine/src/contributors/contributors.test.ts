import { DateTime } from "effect";
import { describe, expect, it } from "vitest";

import { at, classifiedCommit } from "../testing/classified-commit.js";
import { contributors } from "./contributors.js";

const now = DateTime.makeUnsafe("2026-07-01T00:00:00Z");
const grace = { name: "Grace", email: "grace@example.com" };

const run = (
  commits: Parameters<typeof contributors>[0]["commits"],
  scope = ".",
) =>
  contributors({
    commits,
    scope,
    now,
    isCodePath: (path) => path.endsWith(".ts"),
  });

const touching = (path: string) =>
  classifiedCommit({ changes: [{ path, added: 1, deleted: 0 }] });

describe("contributors", () => {
  it("counts commits and agent-assisted commits per identity", () => {
    const result = run([
      classifiedCommit(),
      classifiedCommit({ class: "agent-assisted", tool: "Claude Code" }),
      classifiedCommit({ author: grace }),
    ]);

    expect(
      result.map(({ email, commits, agentAssistedCommits }) => [
        email,
        commits,
        agentAssistedCommits,
      ]),
    ).toStrictEqual([
      ["ada@example.com", 2, 1],
      ["grace@example.com", 1, 0],
    ]);
  });

  it("leaves bot and agent authors out", () => {
    const result = run([
      classifiedCommit({ class: "bot", tool: "Dependabot" }),
      classifiedCommit({ class: "agent", tool: "Jules", author: grace }),
    ]);

    expect(result).toStrictEqual([]);
  });

  it("sorts by commits descending, then by name", () => {
    const zoe = { name: "Zoe", email: "zoe@example.com" };
    const result = run([
      classifiedCommit({ author: zoe }),
      classifiedCommit({ author: grace }),
      classifiedCommit(),
      classifiedCommit(),
    ]);

    expect(result.map(({ name }) => name)).toStrictEqual([
      "Ada",
      "Grace",
      "Zoe",
    ]);
  });
});

describe("contributors time and lines", () => {
  it("counts distinct local dates as active days", () => {
    // Sunday 23:30 at -05:00 and Monday 02:00 UTC are both Sunday locally
    const result = run([
      classifiedCommit({
        time: at("2026-03-02T04:30:00Z"),
        offsetMinutes: -300,
      }),
      classifiedCommit({ time: at("2026-03-01T12:00:00Z") }),
      classifiedCommit({ time: at("2026-03-03T12:00:00Z") }),
    ]);

    expect(result[0]?.activeDays).toBe(2);
  });

  it("counts the lines of code paths only, so a lockfile change adds nothing", () => {
    const result = run([
      classifiedCommit({
        changes: [
          { path: "src/a.ts", added: 7, deleted: 3 },
          { path: "pnpm-lock.yaml", added: 500, deleted: 100 },
        ],
      }),
    ]);

    expect(result[0]).toMatchObject({ added: 7, deleted: 3 });
  });
});

describe("contributors areas", () => {
  it("cuts areas at depth two below the scope and keeps the top three by commits", () => {
    const result = run([
      touching("src/a/b/c/deep.ts"),
      touching("src/a/b/other.ts"),
      touching("src/a/b/more.ts"),
      touching("docs/guide.md"),
      touching("docs/intro.md"),
      touching("README.md"),
      touching("tools/x.ts"),
    ]);

    expect(result[0]?.areas).toStrictEqual([
      { path: "src/a", commits: 3 },
      { path: "docs", commits: 2 },
      { path: ".", commits: 1 },
    ]);
  });

  it("cuts areas relative to a scope and counts a commit once per area", () => {
    const result = run(
      [
        classifiedCommit({
          changes: [
            { path: "packages/engine/src/a/x.ts", added: 1, deleted: 0 },
            { path: "packages/engine/src/a/y.ts", added: 1, deleted: 0 },
            { path: "packages/engine/test/z.ts", added: 1, deleted: 0 },
          ],
        }),
      ],
      "packages/engine",
    );

    expect(result[0]?.areas).toStrictEqual([
      { path: "packages/engine/src/a", commits: 1 },
      { path: "packages/engine/test", commits: 1 },
    ]);
  });
});

describe("contributors activity", () => {
  it("marks a contributor active with a commit exactly 183 days before now, and inactive one day earlier", () => {
    // 183 days before 2026-07-01T00:00:00Z is 2025-12-30T00:00:00Z
    const result = run([
      classifiedCommit({ time: at("2025-12-30T00:00:00Z") }),
      classifiedCommit({ time: at("2025-12-29T00:00:00Z"), author: grace }),
    ]);

    expect(result.map(({ email, active }) => [email, active])).toStrictEqual([
      ["ada@example.com", true],
      ["grace@example.com", false],
    ]);
  });

  it("reports the first and last commit time of each contributor as ISO timestamps", () => {
    const result = run([
      classifiedCommit({ time: at("2026-02-01T10:00:00Z") }),
      classifiedCommit({ time: at("2026-01-01T08:30:00Z") }),
      classifiedCommit({ time: at("2026-03-01T23:00:00Z") }),
    ]);

    expect(result[0]).toMatchObject({
      firstCommitAt: "2026-01-01T08:30:00.000Z",
      lastCommitAt: "2026-03-01T23:00:00.000Z",
    });
  });

  it("uses the name of the identity its commits carry", () => {
    const result = run([
      classifiedCommit({
        author: { name: "Ada L.", email: "ada@example.com" },
      }),
    ]);

    expect(result[0]?.name).toBe("Ada L.");
  });

  it("returns no contributors for no commits", () => {
    expect(run([])).toStrictEqual([]);
  });
});
