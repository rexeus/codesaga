import { describe, expect, it } from "vitest";

import { layoutAutomation } from "./automation.js";

// 366 x 132 leaves a 310 x 100 plot; 20 commits in the busiest month make the
// axis 0 to 20, so one commit is 5 px.
const SIZE = { width: 366, height: 132 };

const months = [
  { month: "2024-01", human: 10, agentAssisted: 5, agent: 0, bot: 5 },
  { month: "2024-02", human: 4, agentAssisted: 0, agent: 0, bot: 0 },
];

const layoutOf = () => {
  const layout = layoutAutomation(months, SIZE);
  if (layout === null) {
    throw new Error("expected a layout");
  }
  return layout;
};

describe("layoutAutomation", () => {
  it("stacks human, agent-assisted, agent and bot from the baseline up", () => {
    const [january] = layoutOf().stacks;

    expect(january?.segments.map(({ key }) => key)).toEqual([
      "human",
      "agentAssisted",
      "agent",
      "bot",
    ]);
    expect(january?.segments.map(({ y, height }) => [y, height])).toEqual([
      [50, 50],
      // a 2 px surface gap is cut from the top of every segment above the first
      [27, 23],
      [25, 0],
      [2, 23],
    ]);
  });

  it("reports each month's total", () => {
    expect(layoutOf().stacks.map(({ total }) => total)).toEqual([20, 4]);
  });

  it("rounds only the data end of a stack", () => {
    const [january, february] = layoutOf().stacks;

    expect(january?.segments.map(({ radius }) => radius)).toEqual([0, 0, 0, 4]);
    expect(february?.segments.map(({ radius }) => radius)).toEqual([
      4, 0, 0, 0,
    ]);
  });

  it("returns null without months", () => {
    expect(layoutAutomation([], SIZE)).toBeNull();
  });
});
