import type { Report } from "@codesaga/engine";

import { formatCount } from "./format.js";
import type { IconName } from "./icons.js";

/** One part of the commits' authorship bar, with the entity class of its color. */
type AuthorshipPart = {
  readonly label: string;
  readonly count: number;
  readonly entity: string;
};

/** A detected bot or agent and what it did. */
type ToolView = {
  readonly name: string;
  readonly kind: "agent" | "bot";
  readonly icon: IconName;
  /** `370 authored`, `180 assisted`, or both joined by a dot. */
  readonly counts: string;
};

/** The Bots & Agents card: who wrote the commits, and which tools took part. */
export type BotsCard = {
  readonly parts: readonly AuthorshipPart[];
  readonly tools: readonly ToolView[];
};

const counted = (count: number, verb: string): string[] =>
  count === 0 ? [] : [`${formatCount(count)} ${verb}`];

/**
 * The card's content, or null when the history shows no bot or agent, so a
 * repository without automation shows no card at all.
 */
export const botsCard = ({ automation }: Report): BotsCard | null => {
  const { human, agentAssisted, agent, bot } = automation.totals;
  if (automation.tools.length === 0 && agent + bot === 0) {
    return null;
  }
  const parts: AuthorshipPart[] = [
    { label: "Humans alone", count: human, entity: "slot-1" },
    { label: "Humans with agent help", count: agentAssisted, entity: "slot-7" },
    { label: "Agent-authored", count: agent, entity: "slot-3" },
    { label: "Bots", count: bot, entity: "slot-other" },
  ];
  return {
    parts: parts.filter(({ count }) => count > 0),
    tools: automation.tools.map(({ name, kind, authored, assisted }) => ({
      name,
      kind,
      icon: kind === "agent" ? "spark" : "bot",
      counts: [
        ...counted(authored, "authored"),
        ...counted(assisted, "assisted"),
      ].join(" · "),
    })),
  };
};
