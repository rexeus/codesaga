import type { Report } from "@codesaga/engine";

import { highlightCards } from "../present/highlights.js";
import type { HighlightCard, HighlightViz } from "../present/highlights.js";
import { h, richText, s } from "./dom.js";
import { icon } from "./icons.js";
import { section } from "./section.js";

const TIMELINE = { width: 300, height: 34, left: 4, right: 296, line: 20 };

const caption = (x: number, anchor: string, text: string): SVGElement =>
  s("text", { x, y: 8, "text-anchor": anchor }, text);

const timeline = (anniversaries: readonly number[]): SVGElement => {
  const { width, height, left, right, line } = TIMELINE;
  const at = (fraction: number): number => left + (right - left) * fraction;
  const svg = s(
    "svg",
    {
      class: "timeline",
      viewBox: `0 0 ${width} ${height}`,
      "aria-hidden": "true",
    },
    s("line", { class: "track", x1: left, x2: right, y1: line, y2: line }),
    s("line", { class: "done", x1: left, x2: right, y1: line, y2: line }),
    ...anniversaries.map((fraction) =>
      s("circle", {
        class: "milestone",
        cx: at(Math.min(1, fraction)),
        cy: line,
        r: 6,
      }),
    ),
    s("circle", { class: "start", cx: left, cy: line, r: 4 }),
    s("circle", { class: "now", cx: right, cy: line, r: 4 }),
    caption(left, "start", "day one"),
    caption(right, "end", "today"),
  );
  return svg;
};

const dots = (count: number): HTMLElement =>
  h("div", "dots", ...Array.from({ length: count }, () => h("i", "")));

const shareBar = (part: number, rest: number): HTMLElement => {
  const first = h("i", "");
  first.style.flexGrow = String(part);
  const bar = h("div", "share-bar", first);
  if (rest > 0) {
    const second = h("i", "");
    second.style.flexGrow = String(rest);
    bar.append(second);
  }
  return bar;
};

const peopleStack = (
  viz: Extract<HighlightViz, { kind: "people" }>,
): HTMLElement =>
  h(
    "div",
    "avatars",
    ...viz.people.map(({ initials, entity }) =>
      h("span", `avatar ${entity}`, initials),
    ),
    ...(viz.more > 0 ? [h("span", "more", `+${viz.more}`)] : []),
  );

const bars = (viz: Extract<HighlightViz, { kind: "bars" }>): HTMLElement =>
  h(
    "div",
    "bars",
    ...viz.bars.map(({ height, on }) => {
      const bar = h("i", on ? "on" : "");
      bar.style.height = `${Math.round(height * 100)}%`;
      return bar;
    }),
  );

const picture = (viz: HighlightViz): Node => {
  if (viz.kind === "timeline") {
    return timeline(viz.anniversaries);
  }
  if (viz.kind === "dots") {
    return dots(viz.count);
  }
  if (viz.kind === "share") {
    return shareBar(viz.part, viz.rest);
  }
  if (viz.kind === "people") {
    return peopleStack(viz);
  }
  if (viz.kind === "bars") {
    return bars(viz);
  }
  return h("span", viz.kind === "path" ? "path-chip" : "pill", viz.text);
};

const card = (highlight: HighlightCard): HTMLElement =>
  h(
    "li",
    `card hl slot-${highlight.slot}`,
    h(
      "div",
      "row",
      h("span", "ico", icon(highlight.icon, 18)),
      h("span", "kind", highlight.title),
    ),
    h(
      "div",
      "big",
      highlight.big,
      ...(highlight.unit === "" ? [] : [h("small", "", highlight.unit)]),
    ),
    h("p", "txt", ...richText(highlight.text)),
    ...(highlight.viz === null
      ? []
      : [h("div", "viz", picture(highlight.viz))]),
    h("div", "ev", highlight.evidence),
  );

/** The strip of notable facts the engine found; null when the report has none, so the section disappears. */
export const renderHighlights = (report: Report): HTMLElement | null => {
  const cards = highlightCards(report);
  if (cards.length === 0) {
    return null;
  }
  return section(
    "highlights",
    "Highlights",
    "Little things worth knowing",
    "Facts computed from the git history, nothing estimated.",
    h("ul", "hl-grid", ...cards.map((highlight) => card(highlight))),
  );
};
