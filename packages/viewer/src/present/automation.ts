import type { Report } from "@codesaga/engine";

type Totals = Report["automation"]["totals"];

/** The four commit classes in stack order, bottom to top. */
export const AUTOMATION_CLASSES = [
  { key: "human", label: "Human", entity: "c-human" },
  { key: "agentAssisted", label: "Agent-assisted", entity: "c-assisted" },
  { key: "agent", label: "Agent", entity: "c-agent" },
  { key: "bot", label: "Bot", entity: "c-bot" },
] as const;

/** A class's commits and its share of all commits the totals count (0 to 1). */
export type ClassShare = {
  readonly label: string;
  readonly entity: string;
  readonly commits: number;
  readonly share: number;
};

/** The class shares of `totals`, in stack order; a total of zero gives zero shares. */
export const classShares = (totals: Totals): ClassShare[] => {
  const all = AUTOMATION_CLASSES.reduce((sum, { key }) => sum + totals[key], 0);
  return AUTOMATION_CLASSES.map(({ key, label, entity }) => ({
    label,
    entity,
    commits: totals[key],
    share: all === 0 ? 0 : totals[key] / all,
  }));
};
