import type { ExpertView, TerritoryView } from "../present/territories.js";
import { h } from "./dom.js";
import { bindTooltip } from "./tooltip.js";

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

/** The experts as a stacked bar: a segment each, the files nobody is expert on in the neutral rest. */
export const expertBar = (
  territory: TerritoryView,
  thin = false,
): HTMLElement => {
  const element = h(
    "div",
    `ebar${thin ? " thin" : ""}`,
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

/** The first `count` experts, a row each, with their share of the files. */
export const expertRows = (
  { experts }: TerritoryView,
  count: number,
): HTMLElement =>
  h(
    "div",
    "experts",
    ...experts.slice(0, count).map((expert) => expertRow(expert)),
  );

/** The two biggest experts on one line, for the small card of a territory inside another. */
export const ownerLine = ({ experts }: TerritoryView): HTMLElement =>
  h(
    "div",
    "owners-line",
    ...experts
      .slice(0, 2)
      .map((expert) =>
        h(
          "span",
          "own",
          h("i", `sw ${expert.entity}${expert.active ? "" : " hatch"}`),
          expert.name,
          " ",
          h("b", "", expert.share),
        ),
      ),
  );

/** The authors of the most lines, when the analysis ran with blame; bots and agents are named as such. */
export const lineOwners = ({
  lineOwners: owners,
}: TerritoryView): HTMLElement[] =>
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
