import type { Report } from "@codesaga/engine";

import { formatCount, formatNoun } from "../present/format.js";
import type { IconName } from "../present/icons.js";
import type { TerritoryView } from "../present/territories.js";
import { h } from "./dom.js";
import { icon } from "./icons.js";
import { bindTooltip } from "./tooltip.js";

/** What the territory cards need from the knowledge section that owns their state. */
export type TreeControls = {
  readonly report: Report;
  readonly solo: boolean;
  /** The detail the slider is on, a number from 1. */
  readonly detail: number;
  readonly isStatsOpen: (key: string) => boolean;
  readonly toggleOpen: (key: string) => void;
  readonly toggleStats: (key: string) => void;
  /** Moves the slider to `detail` and hands the keyboard focus to the control `focus` names. */
  readonly showDetail: (detail: number, focus: string) => void;
  /** The entity class of a language by name, see `languageEntities`. */
  readonly languageEntity: (language: string) => string;
};

const TRUCK_HINT =
  "People who must leave before more than half of the files have no expert";

const KIND_ICONS: Record<TerritoryView["node"]["kind"], IconName> = {
  package: "package",
  folder: "folder",
  other: "files",
};

const KIND_LABELS: Record<TerritoryView["node"]["kind"], string> = {
  package: "Package",
  folder: "Folder",
  other: "Other files",
};

/**
 * Marks `element` as a control the knowledge section may hand the focus back
 * to after it redraws, which replaces the elements. The id is `<action>:<key>`.
 */
export const focusable = <Element extends HTMLElement>(
  element: Element,
  id: string,
): Element => {
  element.dataset["focus"] = id;
  return element;
};

/** The glyph of the territory's kind in a small tile; its name is the tile's label. */
export const kindChip = ({ node, file }: TerritoryView): HTMLElement => {
  const label = file ? "File" : KIND_LABELS[node.kind];
  const chip = h(
    "span",
    "tkind",
    icon(file ? "file" : KIND_ICONS[node.kind], 15),
  );
  chip.title = label;
  chip.setAttribute("role", "img");
  chip.setAttribute("aria-label", label);
  return chip;
};

/** The path with its parent dimmed and its own name strong; other files say which territory holds them. */
export const pathTitle = ({
  parent,
  leaf,
  other,
}: TerritoryView): HTMLElement => {
  if (other) {
    const holder = `${parent}${leaf}`;
    return h(
      "span",
      "path",
      h("b", "", "Other files"),
      ...(leaf === "/ (root)" ? [] : [h("span", "of", ` in ${holder}`)]),
    );
  }
  return h("span", "path", parent, h("b", "", leaf));
};

/** `25 files · 19% of files · changed 5 weeks ago`. */
export const metaLine = ({
  files,
  share,
  changed,
}: TerritoryView): HTMLElement =>
  h(
    "div",
    "meta",
    h("b", "", formatNoun(files, "file")),
    ` · ${share} of the files · changed ${changed}`,
  );

/** The truck factor as a pill that grades itself, with the rule behind it as a tooltip. */
export const truckPill = ({
  truckFactor,
  risk,
}: TerritoryView): HTMLElement => {
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

/** What a card's small toggle button shows and does. */
type Toggle = {
  readonly label: string;
  readonly expanded: boolean;
  readonly onClick: () => void;
  /** The control the section hands the keyboard focus back to, see `focusable`. */
  readonly focus: string;
  readonly glyph?: IconName;
};

/** A small button that shows or hides a part of a card; `expanded` is read out by assistive technology. */
export const toggleButton = ({
  label,
  expanded,
  onClick,
  focus,
  glyph,
}: Toggle): HTMLButtonElement => {
  const button = h(
    "button",
    "mini",
    ...(glyph === undefined ? [] : [icon(glyph, 13, 2)]),
    label,
    icon(expanded ? "chevron-up" : "chevron-down", 15, 2),
  );
  button.type = "button";
  button.setAttribute("aria-expanded", String(expanded));
  button.addEventListener("click", onClick);
  return focusable(button, focus);
};

/** `6 territories inside` and the names of the first three. */
export const insideLine = ({ inside }: TerritoryView): HTMLElement | null =>
  inside === null
    ? null
    : h(
        "div",
        "inside",
        icon("split", 14, 2),
        h("span", "", `${formatCount(inside.count)} territories inside`),
        h(
          "span",
          "chips-mini",
          ...inside.names.map((name) => h("span", "mc", name)),
          ...(inside.more === 0
            ? []
            : [h("span", "mc more", `+${inside.more}`)]),
        ),
      );
