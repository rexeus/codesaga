import type { Report } from "@codesaga/engine";

import { layoutRidge } from "../layout/ridge.js";
import { chips, generatedNote, lede, navItems } from "../present/story.js";
import type { Chip } from "../present/story.js";
import { h, richText, s } from "./dom.js";
import { icon } from "./icons.js";

const RIDGE_SIZE = { width: 1440, height: 200 };

const LOGO_PATH = "M6 17.5c3 0 3-9 6-9s3 9 6 9";

const logo = (): SVGElement =>
  s(
    "svg",
    { width: 26, height: 26, viewBox: "0 0 26 26", "aria-hidden": "true" },
    s("rect", { width: 26, height: 26, rx: 8, fill: "currentColor" }),
    s("path", {
      d: LOGO_PATH,
      fill: "none",
      stroke: "#fff",
      "stroke-width": 2.2,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    }),
  );

const prefersDark = (): boolean =>
  matchMedia("(prefers-color-scheme: dark)").matches;

/** The theme button: the page follows the system until it is pressed, then the pressed choice wins. */
const themeToggle = (): HTMLElement => {
  const button = h("button", "iconbtn", icon("moon", 17));
  button.type = "button";
  button.title = "Toggle theme";
  button.setAttribute("aria-label", "Toggle light and dark theme");
  button.addEventListener("click", () => {
    const root = document.documentElement;
    const chosen = root.dataset["theme"];
    const dark = chosen === undefined ? prefersDark() : chosen === "dark";
    root.dataset["theme"] = dark ? "light" : "dark";
  });
  return button;
};

/** The weekly commits as a soft ridge behind the header; nothing for a history of under two weeks. */
const ridge = ({ activity }: Report): HTMLElement | null => {
  const layout = layoutRidge(
    activity.weeks.map(({ commits }) => commits),
    RIDGE_SIZE,
  );
  if (layout === null) {
    return null;
  }
  const { width, height } = layout.size;
  const gradient = s(
    "linearGradient",
    { id: "ridge-fill", x1: 0, y1: 0, x2: 0, y2: 1 },
    s("stop", { class: "tint", offset: 0, "stop-opacity": 0.55 }),
    s("stop", { class: "tint", offset: 1, "stop-opacity": 0.05 }),
  );
  const svg = s(
    "svg",
    { viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "none" },
    s("defs", {}, gradient),
    s("path", { class: "area", d: layout.area }),
    s("path", {
      class: "edge",
      d: layout.edge,
      "vector-effect": "non-scaling-stroke",
    }),
  );
  const host = h("div", "ridge", svg);
  host.setAttribute("aria-hidden", "true");
  return host;
};

const chipView = ({ icon: name, mono, parts }: Chip): HTMLElement =>
  h("span", `chip ${mono ? "mono" : ""}`, icon(name, 15), ...richText(parts));

const shallowNotice = (): HTMLElement =>
  h(
    "p",
    "notice",
    "Shallow clone: history before the oldest fetched commit is missing, so counts undercount. ",
    h("code", "", "git fetch --unshallow"),
    " completes it.",
  );

const nav = (report: Report): HTMLElement => {
  const element = h(
    "nav",
    "nav",
    ...navItems(report).map(({ id, label }) => {
      const link = h("a", "", label);
      link.href = `#${id}`;
      return link;
    }),
  );
  element.setAttribute("aria-label", "Sections");
  return element;
};

/** The page header: brand and theme button, the repository's name and story, its facts and the section links. */
export const renderHeader = (report: Report): HTMLElement => {
  const { name, scope, shallow } = report.repository;
  const backdrop = ridge(report);
  return h(
    "header",
    "hero",
    ...(backdrop === null ? [] : [backdrop]),
    h(
      "div",
      "wrap",
      h(
        "div",
        "topbar",
        h("div", "brand", logo(), "codesaga", h("span", "sub", "saga report")),
        h("div", "right", generatedNote(report), themeToggle()),
      ),
      h("div", "eyebrow", "Repository saga"),
      h("h1", "", scope === "." ? name : `${name} / ${scope}`),
      h("p", "lede", ...richText(lede(report))),
      h("div", "chips", ...chips(report).map((chip) => chipView(chip))),
      ...(shallow ? [shallowNotice()] : []),
      nav(report),
    ),
  );
};
