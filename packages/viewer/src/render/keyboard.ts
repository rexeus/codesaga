import {
  describeReading,
  moveFocus,
  resumeCell,
} from "../present/chart-focus.js";
import type { Grid } from "../present/chart-focus.js";
import { byId } from "./dom.js";
import { hideTooltip, showTooltip } from "./tooltip.js";
import type { TooltipContent } from "./tooltip.js";

/** The values of a chart that the keyboard can visit: one hover area per cell, row by row. */
export type Stops = {
  readonly grid: Grid;
  /** The cell the focus starts on. */
  readonly start: number;
  readonly areas: readonly SVGElement[];
  readonly content: (index: number) => TooltipContent;
  /** Draws the chart's own cursor on a cell, or removes it on null. */
  readonly mark?: (index: number | null) => void;
};

/** What a redrawn chart needs from the one it replaces: where the keyboard had been, and a way to go back. */
type Visit = {
  readonly cell: () => number | null;
  readonly resume: (cell: number | null) => void;
};

const visits = new WeakMap<Element, Visit>();

/** The cell the keyboard last visited in `chart`, or null when it never did. */
export const visitedCell = (chart: Element): number | null =>
  visits.get(chart)?.cell() ?? null;

/** Makes the next focus of `chart` start on `cell` (kept within its cells) instead of its own start. */
export const resumeAt = (chart: Element, cell: number | null): void => {
  visits.get(chart)?.resume(cell);
};

const announce = (text: string): void => {
  byId("chart-status", HTMLElement).textContent = text;
};

/**
 * Makes `svg` one tab stop that walks `stops` with the keys of `moveFocus`.
 * A visited cell shows the tooltip the pointer would show, and a live region
 * reads it out. Escape dismisses the tooltip without leaving the chart.
 */
export const makeReachable = (svg: SVGElement, stops: Stops): void => {
  const { areas, mark } = stops;
  let current = stops.start;
  let visited = false;

  const clear = (): void => {
    areas[current]?.classList.remove("active");
    mark?.(null);
    hideTooltip();
    announce("");
  };
  const reveal = (index: number): void => {
    const area = areas[index];
    if (area === undefined) {
      return;
    }
    areas[current]?.classList.remove("active");
    current = index;
    visited = true;
    area.classList.add("active");
    mark?.(index);
    const box = area.getBoundingClientRect();
    const content = stops.content(index);
    showTooltip(content, {
      clientX: box.left + box.width / 2,
      clientY: box.top + box.height / 2,
    });
    announce(describeReading(content));
  };

  visits.set(svg, {
    cell: () => (visited ? current : null),
    resume: (cell) => {
      current = resumeCell(cell, areas.length, stops.start);
      visited = cell !== null;
    },
  });
  svg.tabIndex = 0;
  svg.addEventListener("focus", () => {
    if (svg.matches(":focus-visible")) {
      reveal(current);
    }
  });
  svg.addEventListener("blur", clear);
  svg.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      clear();
      return;
    }
    if (event.altKey || event.metaKey) {
      return;
    }
    const next = moveFocus(current, stops.grid, event.key, event.ctrlKey);
    if (next !== null) {
      event.preventDefault();
      reveal(next);
    }
  });
};
