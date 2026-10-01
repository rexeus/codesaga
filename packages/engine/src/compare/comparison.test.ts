import { describe, expect, it } from "vitest";

import type { ClassifiedCommit } from "../automation/classify.js";
import { classifiedCommit } from "../testing/classified-commit.js";
import { comparison } from "./comparison.js";

const previousWindow = {
  since: "2025-10-15T00:00:00.000Z",
  until: "2026-01-15T00:00:00.000Z",
};

const ada = { name: "Ada", email: "ada@example.com" };
const grace = { name: "Grace", email: "grace@example.com" };
const linus = { name: "Linus", email: "linus@example.com" };
const claude = {
  name: "claude[bot]",
  email: "claude@users.noreply.github.com",
};

const edit = (path: string, added: number, deleted: number) => [
  { path, added, deleted },
];
const isCodePath = (path: string): boolean => path.endsWith(".ts");

// 4 commits, 2 contributors, 15 lines added and 2 deleted in code files, no AI
const before: ReadonlyArray<ClassifiedCommit> = [
  classifiedCommit({ author: ada, changes: edit("src/a.ts", 10, 2) }),
  classifiedCommit({ author: grace, changes: edit("src/b.ts", 5, 0) }),
  classifiedCommit({
    class: "bot",
    tools: ["Dependabot"],
    changes: edit("pnpm-lock.yaml", 300, 200),
  }),
  classifiedCommit({ author: ada }),
];

// 6 commits, 3 contributors, 40 lines added and 10 deleted, 3 of 6 commits with AI
const after: ReadonlyArray<ClassifiedCommit> = [
  classifiedCommit({ author: ada, changes: edit("src/a.ts", 20, 4) }),
  classifiedCommit({
    class: "agent-assisted",
    tools: ["Claude Code"],
    author: grace,
    changes: edit("src/b.ts", 10, 6),
  }),
  classifiedCommit({
    class: "agent",
    tools: ["Claude Code"],
    author: claude,
    changes: edit("src/c.ts", 10, 0),
  }),
  classifiedCommit({
    class: "agent-assisted",
    tools: ["Claude Code"],
    author: linus,
  }),
  classifiedCommit({ author: ada }),
  classifiedCommit({ author: grace }),
];

describe("comparison", () => {
  it("reports both spans and what changed from the previous one", () => {
    const result = comparison({
      current: after,
      previous: { window: previousWindow, partial: false, commits: before },
      isCodePath,
    });

    expect(result).toStrictEqual({
      previous: {
        ...previousWindow,
        partial: false,
        commits: 4,
        activeContributors: 2,
        added: 15,
        deleted: 2,
        automation: { human: 3, agentAssisted: 0, agent: 0, bot: 1 },
        aiShare: 0,
      },
      current: {
        commits: 6,
        activeContributors: 3,
        added: 40,
        deleted: 10,
        automation: { human: 3, agentAssisted: 2, agent: 1, bot: 0 },
        aiShare: 0.5,
      },
      delta: {
        commits: { change: 2, ratio: 0.5 },
        activeContributors: { change: 1, ratio: 0.5 },
        // 25 / 15 and 8 / 2
        added: { change: 25, ratio: 1.6667 },
        deleted: { change: 8, ratio: 4 },
        aiShare: 0.5,
      },
    });
  });

  it("reports a decrease as negative and a missing previous value without a ratio", () => {
    const shrunk = comparison({
      current: before,
      previous: { window: previousWindow, partial: false, commits: after },
      isCodePath,
    });
    const fromNothing = comparison({
      current: before,
      previous: { window: previousWindow, partial: false, commits: [] },
      isCodePath,
    });

    expect(shrunk.delta).toStrictEqual({
      commits: { change: -2, ratio: -0.3333 },
      activeContributors: { change: -1, ratio: -0.3333 },
      added: { change: -25, ratio: -0.625 },
      deleted: { change: -8, ratio: -0.8 },
      aiShare: -0.5,
    });
    expect(fromNothing.delta.commits).toStrictEqual({ change: 4, ratio: null });
  });
});

describe("comparison without commits to compare", () => {
  it("reports no AI share change when either span has no commits", () => {
    const noPrevious = comparison({
      current: after,
      previous: { window: previousWindow, partial: true, commits: [] },
      isCodePath,
    });
    const noCurrent = comparison({
      current: [],
      previous: { window: previousWindow, partial: false, commits: after },
      isCodePath,
    });

    expect(noPrevious.delta.aiShare).toBeNull();
    expect(noPrevious.previous.partial).toBe(true);
    expect(noCurrent.delta.aiShare).toBeNull();
  });
});
