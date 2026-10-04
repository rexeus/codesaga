import { formatCount } from "../present/format.js";
import { idiomRows, idiomsTeaser } from "../present/typescript-idioms.js";
import type { IdiomRow } from "../present/typescript-idioms.js";
import type { TypeScriptDeepDive } from "../present/typescript-summary.js";
import { weightedSegment } from "./card.js";
import { h } from "./dom.js";
import { foldCard } from "./fold-card.js";

type Idioms = NonNullable<TypeScriptDeepDive["idioms"]>;

const idiomRow = ({ title, sides }: IdiomRow): HTMLElement =>
  h(
    "div",
    "idiom",
    h("div", "slabel", title),
    h(
      "div",
      "tbar big",
      ...sides
        .filter(({ count }) => count > 0)
        .map(({ label, count, entity, share }) =>
          weightedSegment(
            count,
            entity,
            `${label}: ${formatCount(count)} (${share})`,
          ),
        ),
    ),
    h(
      "ul",
      "legend",
      ...sides.map(({ label, figure, share, entity }) =>
        h(
          "li",
          "",
          h("span", `swatch ${entity}`),
          h("span", "", label),
          h("strong", "", share),
          h("span", "muted", figure),
        ),
      ),
    ),
  );

/**
 * Paired ways of writing the same thing in production code, each as a 100%
 * bar. It describes and does not recommend: no study says which side is
 * better, so the colors carry no good or bad.
 */
export const idiomsCard = (idioms: Idioms): HTMLElement => {
  const rows = idiomRows(idioms);
  return foldCard(
    "Idioms",
    "Ways of writing the same thing, as shares of each pair",
    idiomsTeaser(idioms, rows),
    rows.length === 0
      ? h("p", "empty", "The production code has none of these constructs.")
      : h("div", "idioms", ...rows.map((row) => idiomRow(row))),
    h(
      "p",
      "note",
      "Calls are counted by method name, since no types are known. Tests are left out, as they are written in another style.",
    ),
  );
};
