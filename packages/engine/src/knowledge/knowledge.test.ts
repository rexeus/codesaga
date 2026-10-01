import { DateTime } from "effect";
import { describe, expect, it } from "vitest";

import type { ClassifiedCommit } from "../automation/classify.js";
import { at, classifiedCommit } from "../testing/classified-commit.js";
import { knowledge } from "./knowledge.js";

const now = DateTime.makeUnsafe("2026-03-01T00:00:00Z");
const ada = { name: "Ada", email: "ada@example.com" };
const grace = { name: "Grace", email: "grace@example.com" };
const dependabot = { name: "dependabot[bot]", email: "bot@example.com" };

/** One commit that adds 10 lines to each of `paths`. */
const touching = (
  time: string,
  paths: ReadonlyArray<string>,
  overrides: Partial<ClassifiedCommit> = {},
): ClassifiedCommit =>
  classifiedCommit({
    time: at(time),
    changes: paths.map((path) => ({ path, added: 10, deleted: 0 })),
    ...overrides,
  });

const files = (...paths: ReadonlyArray<string>) =>
  paths.map((path) => ({ path, loc: 50 }));

const run = (
  commits: ReadonlyArray<ClassifiedCommit>,
  paths: ReadonlyArray<string>,
  scope = ".",
) =>
  knowledge({
    commits,
    universe: files(...paths),
    scope,
    headTime: at("2026-02-01T00:00:00Z"),
    now,
  });

const srcFiles = ["src/a.ts", "src/b.ts", "src/c.ts"];

describe("knowledge", () => {
  it("names the people whose departure leaves most files without an expert", () => {
    const result = run(
      [
        touching("2026-01-02T00:00:00Z", ["docs/x.ts", "docs/y.ts"], {
          author: grace,
        }),
        touching("2026-01-01T00:00:00Z", srcFiles, { author: ada }),
      ],
      [...srcFiles, "docs/x.ts", "docs/y.ts"],
    );

    expect(result.truckFactor.value).toBe(1);
    expect(result.truckFactor.people.map(({ email }) => email)).toStrictEqual([
      "ada@example.com",
    ]);
  });

  it("counts files without any expert and files without an active expert", () => {
    const result = run(
      [
        touching("2025-12-01T00:00:00Z", ["bot.ts"], {
          author: dependabot,
          class: "bot",
          tools: ["dependabot[bot]"],
        }),
        touching("2025-06-01T00:00:00Z", ["gone.ts"], { author: grace }),
        touching("2026-02-20T00:00:00Z", ["here.ts"], { author: ada }),
      ],
      ["bot.ts", "gone.ts", "here.ts"],
    );

    expect(result).toMatchObject({
      files: 3,
      withoutExpert: 1,
      withoutActiveExpert: 2,
    });
  });

  it("never makes a bot or an agent an expert, and gives them no first authorship", () => {
    const result = run(
      [
        touching("2026-01-03T00:00:00Z", srcFiles, {
          author: dependabot,
          class: "bot",
          tools: ["dependabot[bot]"],
        }),
        touching("2026-01-02T00:00:00Z", srcFiles, {
          author: { name: "Claude", email: "claude@example.com" },
          class: "agent",
          tools: ["Claude Code"],
        }),
        touching("2026-01-01T00:00:00Z", srcFiles, { author: ada }),
      ],
      srcFiles,
    );

    expect(result.directories[0]?.experts).toMatchObject([
      { email: "ada@example.com", files: 3, soleFiles: 3 },
    ]);
  });
});

describe("knowledge of humans and agents", () => {
  it("credits an agent-assisted commit to its human author", () => {
    const result = run(
      [
        touching("2026-01-01T00:00:00Z", srcFiles, {
          class: "agent-assisted",
          tools: ["Claude Code"],
        }),
      ],
      srcFiles,
    );

    expect(result.directories[0]?.experts).toMatchObject([
      { email: "ada@example.com", files: 3 },
    ]);
    expect(result.withoutExpert).toBe(0);
  });
});

describe("knowledge islands and orphaned directories", () => {
  it("reports an island and an orphaned directory with their reasons", () => {
    // Ada last committed 2025-06-01, long before now: src is her island and nobody active knows it
    const result = run(
      [touching("2025-06-01T00:00:00Z", srcFiles, { author: ada })],
      srcFiles,
    );

    expect(result.directories).toStrictEqual([
      {
        path: "src",
        files: 3,
        truckFactor: 1,
        island: true,
        orphaned: true,
        experts: [
          {
            name: "Ada",
            email: "ada@example.com",
            active: false,
            lastCommitAt: "2025-06-01T00:00:00.000Z",
            files: 3,
            soleFiles: 3,
            share: 1,
          },
        ],
        reasons: [
          "Ada is the only expert on 3 of 3 files",
          "no active expert for 3 of 3 files (last expert commit 2025-06-01)",
        ],
      },
    ]);
  });

  it("does not flag a directory whose experts overlap and are active", () => {
    const result = run(
      [
        touching("2026-02-20T00:00:00Z", srcFiles, { author: grace }),
        touching("2026-02-19T00:00:00Z", srcFiles, { author: ada }),
      ],
      srcFiles,
    );

    expect(result.directories[0]).toMatchObject({
      island: false,
      orphaned: false,
      reasons: [],
    });
  });
});

describe("knowledge directory list", () => {
  it("lists orphaned directories first, then islands, then the rest", () => {
    const orphaned = ["old/a.ts", "old/b.ts", "old/c.ts"];
    const island = ["solo/a.ts", "solo/b.ts", "solo/c.ts"];
    const shared = ["team/a.ts", "team/b.ts", "team/c.ts", "team/d.ts"];
    const result = run(
      [
        touching("2026-02-21T00:00:00Z", shared, { author: grace }),
        touching("2026-02-20T00:00:00Z", shared, { author: ada }),
        touching("2026-02-19T00:00:00Z", island, { author: ada }),
        touching("2025-01-01T00:00:00Z", orphaned, { author: grace }),
      ],
      [...orphaned, ...island, ...shared],
    );

    expect(result.directories.map(({ path }) => path)).toStrictEqual([
      "old",
      "solo",
      "team",
    ]);
  });

  it("leaves a directory with the same files as its parent to the parent", () => {
    const deep = [
      "packages/engine/src/a.ts",
      "packages/engine/src/b.ts",
      "packages/engine/src/c.ts",
    ];
    const result = run(
      [touching("2026-02-20T00:00:00Z", deep, { author: ada })],
      deep,
    );

    expect(result.directories.map(({ path }) => path)).toStrictEqual([
      "packages",
    ]);
  });

  it("reports nested directories that hold more than their parent's chain", () => {
    const paths = [
      "packages/engine/src/a.ts",
      "packages/engine/src/b.ts",
      "packages/engine/src/c.ts",
      "packages/engine/package.ts",
      "packages/cli/index.ts",
    ];
    const result = run(
      [touching("2026-02-20T00:00:00Z", paths, { author: ada })],
      paths,
    );

    expect(result.directories.map(({ path }) => path).toSorted()).toStrictEqual(
      ["packages", "packages/engine", "packages/engine/src"],
    );
  });
});

describe("knowledge chain rule and scope", () => {
  it("omits directories with fewer than three files and never lists the scope itself", () => {
    const result = run(
      [touching("2026-02-20T00:00:00Z", srcFiles, { author: ada })],
      srcFiles,
      "src",
    );

    expect(result.directories).toStrictEqual([]);
  });

  it("returns an empty section for an empty universe", () => {
    expect(run([], [])).toStrictEqual({
      files: 0,
      withoutExpert: 0,
      withoutActiveExpert: 0,
      truckFactor: { value: 0, people: [] },
      directories: [],
    });
  });
});
