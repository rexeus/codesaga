import { formatCount } from "../present/format.js";
import type { TerritoryView, ExpertView } from "../present/territories.js";
import { badgeChips } from "./badges.js";
import { h } from "./dom.js";
import { icon } from "./icons.js";
import { bindTooltip } from "./tooltip.js";

const TRUCK_HINT =
  "People who must leave before more than half of the files have no expert";

const title = ({ parent, leaf, other }: TerritoryView): HTMLElement =>
  h(
    "div",
    "path",
    parent,
    h("b", "", leaf),
    ...(other ? [h("span", "other", " · other files")] : []),
  );

const meta = ({ files, share, changed }: TerritoryView): HTMLElement =>
  h(
    "div",
    "meta",
    h("b", "", `${formatCount(files)} ${files === 1 ? "file" : "files"}`),
    ` · ${share} of the files · changed ${changed}`,
  );

/** The authors of the most lines, when the analysis ran with blame; bots and agents are named as such. */
const lineOwners = ({ lineOwners: owners }: TerritoryView): HTMLElement[] =>
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
        label: `of the files${expert.active ? "" : " (dormant)"}`,
        value: expert.share,
      },
    ],
  });
  return element;
};

const bar = (territory: TerritoryView): HTMLElement => {
  const element = h(
    "div",
    "ebar",
    ...territory.segments.map((expert) => segment(expert)),
  );
  if (territory.unclaimed > 0) {
    const rest = h("i", "");
    rest.style.flex = `${territory.unclaimed} 1 0`;
    element.append(rest);
  }
  element.setAttribute("role", "img");
  element.setAttribute(
    "aria-label",
    `Experts by share of the files: ${territory.segments.map(({ name, share }) => `${name} ${share}`).join(", ")}`,
  );
  return element;
};

const expertRow = (expert: ExpertView): HTMLElement =>
  h(
    "div",
    "ex",
    h("span", `sw ${expert.entity}${expert.active ? "" : " hatch"}`),
    h("span", "nm", expert.name),
    ...(expert.active ? [] : [h("span", "tag", "dormant")]),
    h("span", "pc", expert.share),
  );

const truckPill = ({ truckFactor, risk }: TerritoryView): HTMLElement => {
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

/** A territory with its experts as a stacked bar, a row per main expert, its truck factor and its badges. */
export const territoryCard = (territory: TerritoryView): HTMLElement => {
  const footer = [
    ...badgeChips(territory.badges),
    ...(territory.moreExperts === 0
      ? []
      : [
          h(
            "span",
            "pill quiet",
            `+${territory.moreExperts} more ${territory.moreExperts === 1 ? "person" : "people"}`,
          ),
        ]),
  ];
  return h(
    "article",
    "card territory",
    h("div", "top", title(territory), truckPill(territory)),
    meta(territory),
    bar(territory),
    h(
      "div",
      "experts",
      ...territory.experts.map((expert) => expertRow(expert)),
    ),
    ...lineOwners(territory),
    ...(footer.length === 0 ? [] : [h("div", "badges", ...footer)]),
  );
};

/** A solo repository's territory: its size as a number and a bar against the biggest territory, since every expert is the same person. */
export const soloTerritoryCard = (territory: TerritoryView): HTMLElement => {
  const fill = h("i", "");
  fill.style.width = `${Math.max(3, territory.sizeFraction * 100)}%`;
  return h(
    "article",
    "card territory",
    h("div", "top", title(territory)),
    h(
      "div",
      "size",
      formatCount(territory.files),
      h("small", "", territory.files === 1 ? " file" : " files"),
    ),
    h("div", "sizebar", fill),
    h(
      "div",
      "meta",
      `${territory.share} of the files · changed ${territory.changed}`,
    ),
    ...(territory.badges.chips.length === 0
      ? []
      : [h("div", "badges", ...badgeChips(territory.badges))]),
  );
};
