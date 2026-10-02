import type { Report } from "@codesaga/engine";

import { storyCards } from "../present/stories.js";
import type { StoryCard, StoryViz } from "../present/stories.js";
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

const peopleStack = (viz: Extract<StoryViz, { kind: "people" }>): HTMLElement =>
  h(
    "div",
    "avatars",
    ...viz.people.map(({ initials, entity }) =>
      h("span", `avatar ${entity}`, initials),
    ),
    ...(viz.more > 0 ? [h("span", "more", `+${viz.more}`)] : []),
  );

const bars = (viz: Extract<StoryViz, { kind: "bars" }>): HTMLElement =>
  h(
    "div",
    "bars",
    ...viz.bars.map(({ height, on }) => {
      const bar = h("i", on ? "on" : "");
      bar.style.height = `${Math.round(height * 100)}%`;
      return bar;
    }),
  );

const picture = (viz: StoryViz): Node => {
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

const card = (story: StoryCard): HTMLElement =>
  h(
    "li",
    `card story-card slot-${story.slot}`,
    h(
      "div",
      "row",
      h("span", "ico", icon(story.icon, 18)),
      h("span", "kind", story.title),
    ),
    h(
      "div",
      "big",
      story.big,
      ...(story.unit === "" ? [] : [h("small", "", story.unit)]),
    ),
    h("p", "txt", ...richText(story.text)),
    ...(story.viz === null ? [] : [h("div", "viz", picture(story.viz))]),
    h("div", "ev", story.evidence),
  );

/** The strip of notable facts the engine found; null when the report has none, so the section disappears. */
export const renderStories = (report: Report): HTMLElement | null => {
  const cards = storyCards(report);
  if (cards.length === 0) {
    return null;
  }
  return section(
    "stories",
    "Stories",
    "Little things worth knowing",
    "Facts computed from the git history, nothing estimated.",
    h("ul", "story-grid", ...cards.map((story) => card(story))),
  );
};
