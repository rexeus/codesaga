import type { InspectResult } from "@codesaga/engine";
import { describe, expect, it } from "vitest";

import { renderInspect } from "./inspect-view.js";
import { makeStyle } from "./style.js";

const plain = makeStyle(false);

const maya = {
  name: "Maya Lindqvist",
  email: "maya@example.com",
  active: true,
  lastCommitAt: "2026-09-27T15:41:07.000Z",
};
const dmitri = {
  name: "Dmitri Volkov",
  email: "dmitri@example.com",
  active: false,
  lastCommitAt: "2024-12-03T09:26:38.000Z",
};

const result: InspectResult = {
  schemaVersion: 1,
  window: {
    since: "2025-01-01T00:00:00.000Z",
    until: "2026-09-30T10:00:00.000Z",
    commits: 40,
  },
  matches: [
    {
      pattern: "packages/db",
      files: 20,
      truckFactor: 1,
      island: true,
      orphaned: true,
      experts: [
        { ...dmitri, files: 18, soleFiles: 17, share: 0.9 },
        { ...maya, files: 4, soleFiles: 2, share: 0.2 },
      ],
      commits: 32,
      lastCommitAt: "2026-09-28T10:00:00.000Z",
      automation: { human: 19, agentAssisted: 13, agent: 0, bot: 0 },
      reasons: ["Dmitri Volkov is the only expert on 17 of 20 files"],
    },
    {
      pattern: "docs/**",
      files: 3,
      truckFactor: 0,
      island: false,
      orphaned: false,
      experts: [],
      commits: 0,
      lastCommitAt: null,
      automation: { human: 0, agentAssisted: 0, agent: 0, bot: 0 },
      reasons: [],
    },
  ],
  unmatched: [],
};

describe("renderInspect", () => {
  it("renders one block per argument with experts, window and reasons", () => {
    expect(renderInspect(result, plain).split("\n")).toStrictEqual([
      "2025-01-01 to 2026-09-30",
      "",
      "packages/db",
      "20 files · truck factor 1 · orphaned, island",
      "expert          files  share  sole  last commit",
      "Dmitri Volkov      18    90%    17  1 year ago (inactive)",
      "Maya Lindqvist      4    20%     2  2 days ago",
      "32 commits in the window, last 2 days ago",
      "human 19 · agent-assisted 13",
      "- Dmitri Volkov is the only expert on 17 of 20 files",
      "",
      "docs/**",
      "3 files · truck factor 0",
      "No expert found.",
      "No commits in the window.",
    ]);
  });

  it("escapes control characters in the pattern and in names", () => {
    const hostile: InspectResult = {
      ...result,
      matches: result.matches.slice(0, 1).map((entry) =>
        Object.assign({}, entry, {
          pattern: "src/\u001B[31m*",
          experts: [
            {
              ...maya,
              name: "\u001B[2Jevil",
              files: 1,
              soleFiles: 1,
              share: 1,
            },
          ],
        }),
      ),
    };

    const text = renderInspect(hostile, plain);

    expect(text).not.toContain("\u001B");
    expect(text).toContain("src/\\u001b[31m*");
    expect(text).toContain("\\u001b[2Jevil");
  });
});

describe("renderInspect line owners", () => {
  it("lists the line owners under the experts, marking an agent", () => {
    const [db] = result.matches;
    const owner = { email: "a@example.com", kind: "human" } as const;
    const blamed: InspectResult = {
      ...result,
      matches: [
        Object.assign({}, db, {
          lineOwners: {
            lines: 400,
            owners: [
              { ...owner, name: "Maya Lindqvist", lines: 300, share: 0.75 },
              {
                ...owner,
                name: "Claude",
                kind: "agent",
                lines: 100,
                share: 0.25,
              },
            ],
          },
        }),
      ],
    };

    expect(renderInspect(blamed, plain).split("\n").slice(7, 11)).toStrictEqual(
      [
        "line owner      lines  share",
        "Maya Lindqvist    300    75%",
        "Claude (agent)    100    25%",
        "32 commits in the window, last 2 days ago",
      ],
    );
  });
});
