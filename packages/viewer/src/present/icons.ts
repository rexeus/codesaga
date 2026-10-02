/**
 * The Lucide icons the page draws. `scripts/build.ts` inlines exactly these
 * from `lucide-static` and fails when one does not exist, so adding a glyph
 * means adding its Lucide name here.
 */
export const ICON_NAMES = [
  "arrow-down-right",
  "arrow-left-right",
  "arrow-right-left",
  "arrow-up-right",
  "book-open",
  "bot",
  "cake",
  "calendar",
  "crosshair",
  "eye",
  "flag",
  "flame",
  "ghost",
  "git-branch",
  "hash",
  "history",
  "hourglass",
  "indent-increase",
  "info",
  "key-round",
  "layers",
  "moon",
  "refresh-cw",
  "repeat",
  "shield-check",
  "shuffle",
  "snowflake",
  "sprout",
  "sparkles",
  "sun-moon",
  "target",
  "trash-2",
  "tree-palm",
  "truck",
  "user",
  "user-plus",
  "users",
  "weight",
  "zap",
] as const;

export type IconName = (typeof ICON_NAMES)[number];
