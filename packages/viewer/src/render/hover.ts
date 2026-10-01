import type { Zone } from "../layout/plot.js";
import type { Plot } from "./chart-frame.js";
import { s } from "./dom.js";
import { hideTooltip, showTooltip } from "./tooltip.js";
import type { TooltipContent } from "./tooltip.js";

/**
 * A crosshair and one transparent, full-height hit area per zone: the pointer
 * only has to be over the right date, never on a mark. The crosshair snaps to
 * the zone's centre and the tooltip lists every series of that zone. `stops`
 * lets the keyboard visit the same zones, starting at the latest.
 */
export const hoverZones = (
  zones: readonly Zone[],
  height: number,
  content: (index: number) => TooltipContent,
): Required<Plot> => {
  const crosshair = s("line", { class: "crosshair", y1: 0, y2: height });
  crosshair.style.display = "none";
  const mark = (index: number | null): void => {
    const zone = index === null ? undefined : zones[index];
    if (zone === undefined) {
      crosshair.style.display = "none";
      return;
    }
    const centre = zone.x + zone.width / 2;
    crosshair.setAttribute("x1", String(centre));
    crosshair.setAttribute("x2", String(centre));
    crosshair.style.display = "";
  };
  const areas = zones.map((zone, index) => {
    const area = s("rect", {
      class: "zone",
      x: zone.x,
      y: 0,
      width: Math.max(zone.width, 1),
      height,
    });
    area.addEventListener("pointermove", (event) => {
      mark(index);
      showTooltip(content(index), event);
    });
    area.addEventListener("pointerleave", () => {
      mark(null);
      hideTooltip();
    });
    return area;
  });
  return {
    marks: [crosshair, ...areas],
    stops: {
      grid: { rows: 1, columns: zones.length },
      start: zones.length - 1,
      areas,
      content,
      mark,
    },
  };
};
