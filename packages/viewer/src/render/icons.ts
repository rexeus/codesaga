import type { IconName } from "../present/icons.js";
import { s } from "./dom.js";
import { lucideShapes } from "./lucide-shapes.js";

/**
 * A Lucide icon that takes the text color of its surroundings. The shapes come
 * from the build's subset of `lucide-static`, so only the names of
 * `ICON_NAMES` exist.
 */
export const icon = (
  name: IconName,
  size = 18,
  strokeWidth = 1.8,
): SVGElement =>
  s(
    "svg",
    {
      class: "lucide",
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": strokeWidth,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true",
    },
    ...lucideShapes[name].map(([tag, attributes]) => s(tag, attributes)),
  );
