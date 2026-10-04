import { formatNoun } from "../present/format.js";
import {
  couplingRows,
  edgeRows,
  mapNotes,
} from "../present/typescript-imports.js";
import type {
  CouplingRow,
  EdgeRow,
  MapNotes,
  TerritoryName,
} from "../present/typescript-imports.js";
import type { TypeScriptDeepDive } from "../present/typescript-summary.js";
import { card } from "./card.js";
import { breakAfterSlashes, h } from "./dom.js";
import { icon } from "./icons.js";
import { limitedList } from "./limited-list.js";

type Imports = NonNullable<TypeScriptDeepDive["imports"]>;

const EDGE_ROWS = { rows: 8, noun: "edges" };
const COUPLING_ROWS = { rows: 8, noun: "territories" };

const name = ({ name: text, kind }: TerritoryName): HTMLElement =>
  h("span", `tname ${kind}`, ...breakAfterSlashes(text));

const ends = (from: TerritoryName, to: TerritoryName): HTMLElement =>
  h(
    "div",
    "ends",
    name(from),
    h("span", "to", icon("arrow-right", 13, 2), name(to)),
  );

const edgeRow = ({
  from,
  to,
  files,
  pairs,
  fraction,
  typeOnlyFraction,
  typeOnly,
}: EdgeRow): HTMLElement => {
  const fill = h("i", "");
  fill.style.width = `${Math.max(fraction, 0.02) * 100}%`;
  const types = h("i", "types");
  types.style.width = `${typeOnlyFraction * 100}%`;
  fill.append(types);
  const bar = h("span", "bar", fill);
  bar.title = `${pairs}${typeOnly === null ? "" : `, ${typeOnly}`}`;
  return h(
    "div",
    "ts-edge",
    ends(from, to),
    h("div", "edge-fig", h("b", "", files), bar),
  );
};

const couplingRow = (row: CouplingRow): HTMLElement => {
  const fill = h("i", "");
  fill.style.width = `${(row.instabilityFraction ?? 0) * 100}%`;
  return h(
    "div",
    "cp",
    name(row),
    h("span", "num", row.files),
    h("span", "num", row.ca),
    h("span", "num", row.ce),
    h(
      "span",
      "inst",
      h("span", "num", row.instability ?? "–"),
      h("span", "bar", fill),
    ),
  );
};

const groupLine = (group: readonly TerritoryName[]): HTMLElement =>
  h(
    "div",
    "group",
    h("span", "muted", formatNoun(group.length, "territory", "territories")),
    h("div", "chips-line", ...group.map((territory) => name(territory))),
  );

const lessStable = ({
  from,
  to,
  files,
  fromInstability,
  toInstability,
}: MapNotes["towardLessStable"][number]): HTMLElement =>
  h(
    "div",
    "less",
    ends(from, to),
    h(
      "span",
      "muted",
      `${files} · instability ${fromInstability} to ${toInstability}`,
    ),
  );

const mutualBlock = ({ mutual, mutualMore }: MapNotes): Node[] =>
  mutual.length === 0
    ? []
    : [
        h(
          "div",
          "ts-subblock",
          h("div", "slabel", "Territories that import each other"),
          h(
            "p",
            "note",
            "Each has a file that imports a file of another, directly or through others. This is not a file cycle.",
          ),
          ...mutual.map((group) => groupLine(group)),
          ...(mutualMore === null ? [] : [h("p", "note", mutualMore)]),
        ),
      ];

const lessStableBlock = ({ towardLessStable, towardMore }: MapNotes): Node[] =>
  towardLessStable.length === 0
    ? []
    : [
        h(
          "div",
          "ts-subblock",
          h("div", "slabel", "Importing toward less stable territories"),
          h(
            "p",
            "note",
            "Instability is imports out over imports in and out: 0 for a territory others build on, 1 for one that builds on others.",
          ),
          ...towardLessStable.map((edge) => lessStable(edge)),
          ...(towardMore === null ? [] : [h("p", "note", towardMore)]),
        ),
      ];

/**
 * Which territory imports which, as a list sorted by the file pairs of each
 * edge: no graph, so it reads at any width. Under it the groups of territories
 * that import each other and the edges that point toward a less stable one.
 */
export const importMapCard = (imports: Imports): HTMLElement => {
  const notes = mapNotes(imports);
  const rows = edgeRows(imports);
  return card(
    "Import map",
    `Production code between territories at Detail ${notes.detail}: ${notes.counts}. Counts are file pairs`,
    rows.length === 0
      ? h("p", "empty", "No territory imports another.")
      : limitedList(rows, EDGE_ROWS, "edges", edgeRow),
    h(
      "p",
      "note",
      "The lighter part of a bar is the file pairs that import only types.",
    ),
    ...(notes.truncated === null ? [] : [h("p", "note", notes.truncated)]),
    ...mutualBlock(notes),
    ...lessStableBlock(notes),
  );
};

/** Each territory's afferent coupling (edges in), efferent coupling (edges out) and instability. */
export const couplingCard = (imports: Imports): HTMLElement => {
  const rows = couplingRows(imports);
  return card(
    "Coupling",
    "Edges into (Ca) and out of (Ce) each territory, most edges first, and its instability I",
    rows.length === 0
      ? h("p", "empty", "No production file has an import.")
      : h(
          "div",
          "cptable",
          h(
            "div",
            "cp head",
            h("span", "", "Territory"),
            h("span", "num", "Files"),
            h("span", "num", "Ca"),
            h("span", "num", "Ce"),
            h("span", "num", "I"),
          ),
          limitedList(rows, COUPLING_ROWS, "cp-body", couplingRow),
        ),
  );
};
