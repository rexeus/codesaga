import type { IconName } from "./icons.js";

/** The sections of the page. */
export type SectionId =
  | "stories"
  | "activity"
  | "pull-requests"
  | "knowledge"
  | "stats"
  | "achievements"
  | "team"
  | "bots";

/** The glyph that marks a section in its heading and in the navigation. */
export const SECTION_ICONS: Record<SectionId, IconName> = {
  stories: "sparkles",
  activity: "activity",
  "pull-requests": "git-pull-request",
  knowledge: "brain",
  stats: "chart-column",
  achievements: "trophy",
  team: "users",
  bots: "bot",
};
