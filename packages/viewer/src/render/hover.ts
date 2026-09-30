import type { Zone } from "../layout/plot.js";
import { s } from "./dom.js";
import { hideTooltip, showTooltip } from "./tooltip.js";
import type { TooltipContent } from "./tooltip.js";

/**
 * A crosshair and one transparent, full-height hit area per zone: the pointer
 * only has to be over the right date, never on a mark. The crosshair snaps to
 * the zone's centre and the tooltip lists every series of that zone.
 */
export const hoverZones = (
  zones: readonly Zone[],
  height: number,
  content: (index: number) => TooltipContent,
): SVGElement[] => {
  const crosshair = s("line", { class: "crosshair", y1: 0, y2: height });
  crosshair.style.display = "none";
  const areas = zones.map((zone, index) => {
    const area = s("rect", {
      class: "zone",
      x: zone.x,
      y: 0,
      width: Math.max(zone.width, 1),
      height,
    });
    area.addEventListener("pointermove", (event) => {
      const centre = zone.x + zone.width / 2;
      crosshair.setAttribute("x1", String(centre));
      crosshair.setAttribute("x2", String(centre));
      crosshair.style.display = "";
      showTooltip(content(index), event);
    });
    area.addEventListener("pointerleave", () => {
      crosshair.style.display = "none";
      hideTooltip();
    });
    return area;
  });
  return [crosshair, ...areas];
};
