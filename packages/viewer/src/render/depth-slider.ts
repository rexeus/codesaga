import type { Report } from "@codesaga/engine";

import {
  depthTicks,
  levelStatus,
  recommendationHeadline,
  recommendedLevel,
  sliderFill,
} from "../present/areas.js";
import type { DepthTick } from "../present/areas.js";
import { h } from "./dom.js";
import { icon } from "./icons.js";

type Areas = Report["knowledge"]["areas"];

const REC_HINT =
  "Level 1 is a package or top-level folder; each level below splits areas by one more folder. ";

const stopOf = (tick: DepthTick): HTMLElement => {
  const stop = h(
    "div",
    "tick",
    h("b", "", tick.label),
    tick.count,
    h("em", "", "recommended"),
  );
  stop.style.setProperty("--at", String(tick.position));
  return stop;
};

const recommendation = (areas: Areas, jump: HTMLElement | null): HTMLElement =>
  h(
    "div",
    "rec-box",
    h("div", "badge-icon", icon("star", 20)),
    h(
      "div",
      "",
      h("p", "", h("b", "", "Recommended: "), recommendationHeadline(areas)),
      h("p", "", REC_HINT, ...(jump === null ? [] : [jump])),
    ),
  );

/**
 * The depth control: a slider over the levels with a labelled stop each, the
 * recommendation and a button that jumps to it. The slider is a native range
 * input, so the arrow keys, Home and End work; `onSelect` gets the chosen
 * level's index on every change, and once for `start`. A single level has
 * nothing to choose, so only the recommendation shows.
 */
export const depthSlider = (
  areas: Areas,
  start: number,
  onSelect: (index: number) => void,
): HTMLElement => {
  const ticks = depthTicks(areas);
  const stops = ticks.map((tick) => stopOf(tick));
  const input = h("input", "");
  input.type = "range";
  input.min = "0";
  input.max = String(areas.levels.length - 1);
  input.step = "1";
  input.setAttribute("aria-label", "Knowledge area depth");
  const status = h("span", "muted");

  const select = (index: number): void => {
    const level = areas.levels[index];
    const tick = ticks[index];
    if (level === undefined || tick === undefined) {
      return;
    }
    input.value = String(index);
    input.style.setProperty("--fill", `${sliderFill(areas, index) * 100}%`);
    input.setAttribute("aria-valuetext", `${tick.label}, ${tick.count}`);
    status.textContent = levelStatus(level);
    stops.forEach((stop, at) => {
      stop.classList.toggle("on", at === index);
      stop.classList.toggle("rec", ticks[at]?.recommended === true);
    });
    onSelect(index);
  };
  input.addEventListener("input", () => {
    select(Number(input.value));
  });

  const choosable = areas.levels.length > 1;
  const jump = h("button", "linkbtn", "Jump to recommended");
  jump.type = "button";
  jump.addEventListener("click", () => {
    select(recommendedLevel(areas));
  });
  const element = h(
    "div",
    "card kctl",
    ...(choosable
      ? [
          h(
            "div",
            "",
            h("div", "lab", h("span", "", "Depth"), status),
            h("div", "slider", input, h("div", "ticks", ...stops)),
          ),
        ]
      : []),
    recommendation(areas, choosable ? jump : null),
  );
  select(start);
  return element;
};
