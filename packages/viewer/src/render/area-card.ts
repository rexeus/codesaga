import type { AreaView, ExpertView } from "../present/areas.js";
import { formatCount } from "../present/format.js";
import { badgeChips } from "./badges.js";
import { h } from "./dom.js";
import { icon } from "./icons.js";
import { bindTooltip } from "./tooltip.js";

const TRUCK_HINT =
  "People who must leave before more than half of the files have no expert";

const title = ({ parent, leaf, loose }: AreaView): HTMLElement =>
  h(
    "div",
    "path",
    parent,
    h("b", "", leaf),
    ...(loose ? [h("span", "loose", " · loose files")] : []),
  );

const meta = ({ files, share, changed }: AreaView): HTMLElement =>
  h(
    "div",
    "meta",
    h("b", "", `${formatCount(files)} ${files === 1 ? "file" : "files"}`),
    ` · ${share} of the files · changed ${changed}`,
  );

/** The authors of the most lines, when the analysis ran with blame; bots and agents are named as such. */
const lineOwners = ({ lineOwners: owners }: AreaView): HTMLElement[] =>
  owners === null || owners.length === 0
    ? []
    : [
        h(
          "div",
          "owners",
          h("span", "lbl", "Lines"),
          ...owners.map(({ name, share, kind }) =>
            h(
              "span",
              "own",
              name,
              " ",
              h("b", "", share),
              ...(kind === "human" ? [] : [h("span", "tag", kind)]),
            ),
          ),
        ),
      ];

const segment = (expert: ExpertView): HTMLElement => {
  const element = h("i", `${expert.entity}${expert.active ? "" : " hatch"}`);
  element.style.flex = `${expert.weight} 1 0`;
  bindTooltip(element, {
    title: expert.name,
    rows: [
      {
        label: `of the files${expert.active ? "" : " (inactive)"}`,
        value: expert.share,
      },
    ],
  });
  return element;
};

const bar = (area: AreaView): HTMLElement => {
  const element = h(
    "div",
    "ebar",
    ...area.segments.map((expert) => segment(expert)),
  );
  if (area.unclaimed > 0) {
    const rest = h("i", "");
    rest.style.flex = `${area.unclaimed} 1 0`;
    element.append(rest);
  }
  element.setAttribute("role", "img");
  element.setAttribute(
    "aria-label",
    `Experts by share of the files: ${area.segments.map(({ name, share }) => `${name} ${share}`).join(", ")}`,
  );
  return element;
};

const expertRow = (expert: ExpertView): HTMLElement =>
  h(
    "div",
    "ex",
    h("span", `sw ${expert.entity}${expert.active ? "" : " hatch"}`),
    h("span", "nm", expert.name),
    ...(expert.active ? [] : [h("span", "tag", "inactive")]),
    h("span", "pc", expert.share),
  );

const truckPill = ({ truckFactor, risk }: AreaView): HTMLElement => {
  const pill = h(
    "span",
    `pill${risk === "none" ? "" : ` ${risk === "crit" ? "crit" : "warn"}`}`,
    icon("truck", 13),
    `Truck factor ${truckFactor}`,
  );
  pill.tabIndex = 0;
  bindTooltip(pill, { title: "Truck factor", rows: [], text: TRUCK_HINT });
  return pill;
};

/** An area with its experts as a stacked bar, a row per main expert, its truck factor and its badges. */
export const areaCard = (area: AreaView): HTMLElement => {
  const footer = [
    ...badgeChips(area.badges),
    ...(area.moreExperts === 0
      ? []
      : [
          h(
            "span",
            "pill quiet",
            `+${area.moreExperts} more ${area.moreExperts === 1 ? "person" : "people"}`,
          ),
        ]),
  ];
  return h(
    "article",
    "card area",
    h("div", "top", title(area), truckPill(area)),
    meta(area),
    bar(area),
    h("div", "experts", ...area.experts.map((expert) => expertRow(expert))),
    ...lineOwners(area),
    ...(footer.length === 0 ? [] : [h("div", "badges", ...footer)]),
  );
};

/** A solo repository's area: its size as a number and a bar against the biggest area, since every expert is the same person. */
export const soloAreaCard = (area: AreaView): HTMLElement => {
  const fill = h("i", "");
  fill.style.width = `${Math.max(3, area.sizeFraction * 100)}%`;
  return h(
    "article",
    "card area",
    h("div", "top", title(area)),
    h(
      "div",
      "size",
      formatCount(area.files),
      h("small", "", area.files === 1 ? " file" : " files"),
    ),
    h("div", "sizebar", fill),
    h("div", "meta", `${area.share} of the files · changed ${area.changed}`),
    ...(area.badges.chips.length === 0
      ? []
      : [h("div", "badges", ...badgeChips(area.badges))]),
  );
};
