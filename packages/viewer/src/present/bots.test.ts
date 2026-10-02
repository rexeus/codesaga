import type { Report } from "@codesaga/engine";
import { describe, expect, it } from "vitest";

import { sampleReport } from "../testing/reports.js";
import { botsCard } from "./bots.js";

const withAutomation = (automation: Partial<Report["automation"]>): Report => {
  const report = sampleReport();
  return { ...report, automation: { ...report.automation, ...automation } };
};

const none = { human: 100, agentAssisted: 0, agent: 0, bot: 0 };

describe("botsCard", () => {
  it("names each detected tool with what it authored and assisted", () => {
    const card = botsCard(
      withAutomation({
        totals: { human: 248, agentAssisted: 182, agent: 0, bot: 370 },
        tools: [
          { name: "GitHub Actions", kind: "bot", authored: 370, assisted: 0 },
          { name: "Claude Code", kind: "agent", authored: 0, assisted: 180 },
          { name: "Cursor", kind: "agent", authored: 5, assisted: 2 },
        ],
      }),
    );

    expect(card?.tools).toEqual([
      {
        name: "GitHub Actions",
        kind: "bot",
        icon: "bot",
        counts: "370 authored",
      },
      {
        name: "Claude Code",
        kind: "agent",
        icon: "sparkles",
        counts: "180 assisted",
      },
      {
        name: "Cursor",
        kind: "agent",
        icon: "sparkles",
        counts: "5 authored · 2 assisted",
      },
    ]);
  });

  it("splits the commits by who wrote them and leaves out the empty parts", () => {
    const card = botsCard(
      withAutomation({
        totals: { human: 248, agentAssisted: 182, agent: 0, bot: 370 },
        tools: [
          { name: "Dependabot", kind: "bot", authored: 370, assisted: 0 },
        ],
      }),
    );

    expect(card?.parts.map(({ label, count }) => [label, count])).toEqual([
      ["Humans alone", 248],
      ["Humans with agent help", 182],
      ["Bots", 370],
    ]);
  });

  it("has no card when nothing automated was detected", () => {
    expect(botsCard(withAutomation({ totals: none, tools: [] }))).toBeNull();
  });
});
