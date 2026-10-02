import type { Report } from "@codesaga/engine";

import {
  detailTicks,
  detailStatus,
  recommendationHeadline,
  recommendedDetailIndex,
  sliderFill,
} from "../present/detail-slider.js";
import type { DetailTick } from "../present/detail-slider.js";
import { h } from "./dom.js";
import { icon } from "./icons.js";

type Territories = Report["knowledge"]["territories"];

const REC_HINT =
  "Detail 1 is a package or top-level folder; each detail below splits territories by one more folder. ";

const stopOf = (tick: DetailTick): HTMLElement => {
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

const recommendation = (
  territories: Territories,
  jump: HTMLElement | null,
): HTMLElement =>
  h(
    "div",
    "rec-box",
    h("div", "badge-icon", icon("star", 20)),
    h(
      "div",
      "",
      h(
        "p",
        "",
        h("b", "", "Recommended: "),
        recommendationHeadline(territories),
      ),
      h("p", "", REC_HINT, ...(jump === null ? [] : [jump])),
    ),
  );

/**
 * The detail control: a slider over the details with a labelled stop each, the
 * recommendation and a button that jumps to it. The slider is a native range
 * input, so the arrow keys, Home and End work; `onSelect` gets the chosen
 * detail's index on every change, and once for `start`. A single detail has
 * nothing to choose, so only the recommendation shows.
 */
export const detailSlider = (
  territories: Territories,
  start: number,
  onSelect: (index: number) => void,
): HTMLElement => {
  const ticks = detailTicks(territories);
  const stops = ticks.map((tick) => stopOf(tick));
  const input = h("input", "");
  input.type = "range";
  input.min = "0";
  input.max = String(territories.details.length - 1);
  input.step = "1";
  input.setAttribute("aria-label", "Knowledge territory detail");
  const status = h("span", "muted");

  const select = (index: number): void => {
    const detail = territories.details[index];
    const tick = ticks[index];
    if (detail === undefined || tick === undefined) {
      return;
    }
    input.value = String(index);
    input.style.setProperty(
      "--fill",
      `${sliderFill(territories, index) * 100}%`,
    );
    input.setAttribute("aria-valuetext", `${tick.label}, ${tick.count}`);
    status.textContent = detailStatus(detail);
    stops.forEach((stop, at) => {
      stop.classList.toggle("on", at === index);
      stop.classList.toggle("rec", ticks[at]?.recommended === true);
    });
    onSelect(index);
  };
  input.addEventListener("input", () => {
    select(Number(input.value));
  });

  const choosable = territories.details.length > 1;
  const jump = h("button", "linkbtn", "Jump to recommended");
  jump.type = "button";
  jump.addEventListener("click", () => {
    select(recommendedDetailIndex(territories));
  });
  const element = h(
    "div",
    "card kctl",
    ...(choosable
      ? [
          h(
            "div",
            "",
            h("div", "lab", h("span", "", "Detail"), status),
            h("div", "slider", input, h("div", "ticks", ...stops)),
          ),
        ]
      : []),
    recommendation(territories, choosable ? jump : null),
  );
  select(start);
  return element;
};
