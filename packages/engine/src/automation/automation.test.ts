import { describe, expect, it } from "vitest";

import { at, classifiedCommit } from "../testing/classified-commit.js";
import { automation } from "./automation.js";

const window = {
  since: "2026-01-10T00:00:00.000Z",
  until: "2026-03-20T00:00:00.000Z",
};

const agentAuthored = (tool: string, time = "2026-01-15T00:00:00Z") =>
  classifiedCommit({ class: "agent", tool, time: at(time) });
const botAuthored = (tool: string, time = "2026-01-15T00:00:00Z") =>
  classifiedCommit({ class: "bot", tool, time: at(time) });
const assistedBy = (tool: string, time = "2026-01-15T00:00:00Z") =>
  classifiedCommit({ class: "agent-assisted", tool, time: at(time) });

describe("automation", () => {
  it("totals the four classes per window and per month", () => {
    const result = automation({
      window,
      commits: [
        classifiedCommit({ time: at("2026-01-15T00:00:00Z") }),
        assistedBy("Claude Code", "2026-01-20T00:00:00Z"),
        agentAuthored("Jules", "2026-03-02T00:00:00Z"),
        botAuthored("Dependabot", "2026-03-03T00:00:00Z"),
        botAuthored("Dependabot", "2026-03-04T00:00:00Z"),
      ],
    });

    expect(result.totals).toStrictEqual({
      human: 1,
      agentAssisted: 1,
      agent: 1,
      bot: 2,
    });
    expect(result.months).toStrictEqual([
      { month: "2026-01", human: 1, agentAssisted: 1, agent: 0, bot: 0 },
      { month: "2026-02", human: 0, agentAssisted: 0, agent: 0, bot: 0 },
      { month: "2026-03", human: 0, agentAssisted: 0, agent: 1, bot: 2 },
    ]);
  });
});

describe("automation tools", () => {
  it("counts a tool's authored and assisted commits separately", () => {
    const result = automation({
      window,
      commits: [
        agentAuthored("Claude Code"),
        assistedBy("Claude Code"),
        assistedBy("Claude Code"),
      ],
    });

    expect(result.tools).toStrictEqual([
      { name: "Claude Code", kind: "agent", authored: 1, assisted: 2 },
    ]);
  });

  it("lists tools by authored plus assisted commits descending, then name, with their kind", () => {
    const result = automation({
      window,
      commits: [
        botAuthored("Renovate"),
        agentAuthored("Jules"),
        botAuthored("Dependabot"),
        assistedBy("Aider"),
        assistedBy("Aider"),
      ],
    });

    expect(result.tools.map(({ name, kind }) => [name, kind])).toStrictEqual([
      ["Aider", "agent"],
      ["Dependabot", "bot"],
      ["Jules", "agent"],
      ["Renovate", "bot"],
    ]);
  });

  it("lists a generic bot under its account name", () => {
    const result = automation({
      window,
      commits: [botAuthored("deploy-bot[bot]")],
    });

    expect(result.tools).toStrictEqual([
      { name: "deploy-bot[bot]", kind: "bot", authored: 1, assisted: 0 },
    ]);
  });

  it("reports zeros, empty months and no tools for a window without commits", () => {
    const result = automation({ window, commits: [] });

    expect(result.totals).toStrictEqual({
      human: 0,
      agentAssisted: 0,
      agent: 0,
      bot: 0,
    });
    expect(result.months).toHaveLength(3);
    expect(result.tools).toStrictEqual([]);
  });
});
