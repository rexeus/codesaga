import { formatCount } from "../present/format.js";
import type { TypeScriptDeepDive } from "../present/typescript-summary.js";
import {
  counterpartRows,
  escapeSets,
  kindRows,
} from "../present/typescript-type-safety.js";
import type {
  CounterpartRow,
  EscapeSet,
  KindRow,
} from "../present/typescript-type-safety.js";
import { card, weightedSegment } from "./card.js";
import { commaList, h, mono } from "./dom.js";

type TypeSafety = NonNullable<TypeScriptDeepDive["typeSafety"]>;

const setBlock = (
  { label, rate, caption, fileShare, segments }: EscapeSet,
  index: number,
) =>
  h(
    "div",
    index === 0 ? "es-set" : "es-set minor",
    h("div", "slabel", label),
    h(
      "div",
      "es-fig",
      h("b", "", rate),
      h("span", "", " per 1,000 lines"),
      h("span", "muted", ` · ${fileShare}`),
    ),
    h(
      "div",
      "tbar big",
      ...segments
        .filter(({ count }) => count > 0)
        .map(({ label: kind, entity, count }) =>
          weightedSegment(count, entity, `${kind}: ${formatCount(count)}`),
        ),
    ),
    h("p", "note", caption),
  );

const numeric = (...values: readonly string[]): HTMLElement[] =>
  values.map((value) => h("span", "num", value));

const kindRow = ({ label, entity, production, tests }: KindRow): HTMLElement =>
  h(
    "div",
    "kt",
    h("span", "k", h("i", `swatch ${entity}`), label),
    ...numeric(production.count, production.rate, tests?.rate ?? "–"),
  );

const kindTable = (rows: readonly KindRow[], hasTests: boolean): HTMLElement =>
  h(
    "div",
    "ktable",
    h(
      "div",
      "kt head",
      h("span", "", "Production code"),
      ...numeric("Sites", "Per 1,000", hasTests ? "Tests per 1,000" : ""),
    ),
    ...rows.map((row) => kindRow(row)),
  );

/**
 * The escape hatches of the type system as one card: the rate per 1,000 lines
 * and a stacked bar for production code and for tests, then every kind of
 * site with its count and rate. Tests are set apart because they use
 * assertions and `any` on purpose.
 */
export const escapesCard = (typeSafety: TypeSafety): HTMLElement => {
  const sets = escapeSets(typeSafety);
  return card(
    "Escape hatches",
    "Places where the code opts out of the type system, counted from the syntax",
    ...sets.map((set, index) => setBlock(set, index)),
    kindTable(kindRows(typeSafety), typeSafety.tests.files > 0),
  );
};

const counterpartRow = ({ label, note, cell }: CounterpartRow): HTMLElement =>
  h(
    "div",
    "kt",
    h("span", "k two", h("span", "", mono(label)), h("span", "muted", note)),
    ...numeric(cell.count, cell.rate),
  );

/** What keeps types honest and the counts that overlap with the escapes, for production code. */
export const counterpartsCard = (typeSafety: TypeSafety): HTMLElement =>
  card(
    "Counterparts and context",
    "Production code. These overlap with the sites above, so they are not added to them",
    h(
      "div",
      "ktable three",
      h(
        "div",
        "kt head",
        h("span", "", "Construct"),
        ...numeric("Count", "per 1,000"),
      ),
      ...counterpartRows(typeSafety).map((row) => counterpartRow(row)),
    ),
    ...(typeSafety.nocheckFiles.length === 0
      ? []
      : [
          h(
            "p",
            "note",
            "@ts-nocheck in ",
            ...commaList(typeSafety.nocheckFiles.map((path) => mono(path))),
          ),
        ]),
  );
