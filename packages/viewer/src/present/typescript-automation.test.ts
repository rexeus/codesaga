import { describe, expect, it } from "vitest";

import { sampleBlock } from "../testing/reports.js";
import { automationView } from "./typescript-automation.js";

const classes = sampleBlock("trends").escapesByAutomation;
const none = { commits: 0, added: 0, removed: 0 };

describe("automationView", () => {
  it("lists a row per class that has a commit, never a person", () => {
    const view = automationView(classes);

    expect(view?.rows).toEqual([
      { label: "Human", commits: "4 commits", added: "6", removed: "9" },
      {
        label: "Human with an AI agent",
        commits: "1 commit",
        added: "2",
        removed: "0",
      },
    ]);
  });

  it("sums the classes in the teaser", () => {
    expect(automationView(classes)?.teaser).toBe(
      "8 sites added and 9 removed by 5 commits",
    );
  });

  it("says the agent figures are lower bounds", () => {
    expect(automationView(classes)?.caveat).toContain("lower bounds");
    expect(automationView(classes)?.caveat).toContain("never people");
  });

  it("names every class when each has commits", () => {
    const view = automationView({
      human: { commits: 3, added: 1, removed: 2 },
      "agent-assisted": { commits: 1, added: 1, removed: 1 },
      agent: { commits: 2, added: 4, removed: 0 },
      bot: { commits: 1, added: 0, removed: 5 },
    });

    expect(view?.rows.map(({ label }) => label)).toEqual([
      "Human",
      "Human with an AI agent",
      "AI agent",
      "Bot",
    ]);
  });

  it("has nothing to tell when no class changed any TypeScript", () => {
    expect(
      automationView({
        human: none,
        "agent-assisted": none,
        agent: none,
        bot: none,
      }),
    ).toBeNull();
  });
});
