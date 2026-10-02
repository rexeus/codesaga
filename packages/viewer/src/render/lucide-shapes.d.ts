import type { IconName } from "../present/icons.js";

/** One Lucide icon as its drawing elements, such as `["path", { d: "M12 2v2" }]`. */
type IconShape = ReadonlyArray<
  readonly [string, Readonly<Record<string, string>>]
>;

/** The shapes of every `ICON_NAMES` icon; `scripts/build.ts` generates `lucide-shapes.js` from `lucide-static`. */
export declare const lucideShapes: Readonly<Record<IconName, IconShape>>;
