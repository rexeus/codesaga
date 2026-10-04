import type { TerritoryTypeScriptView } from "../present/typescript-territory.js";
import { h } from "./dom.js";
import { caption, comparisonBar, item } from "./territory-stat-parts.js";

const line = (...content: readonly (Node | string)[]): HTMLElement =>
  h("div", "cap", ...content);

const escapes = (view: TerritoryTypeScriptView): HTMLElement =>
  h(
    "div",
    "ts-line",
    caption(view.size),
    ...(view.escapes === null
      ? []
      : [
          caption(
            h("b", "", view.escapes.figure),
            " escape hatches per 1,000 lines",
          ),
          comparisonBar(
            view.escapes,
            `${view.escapes.figure} escape hatches per 1,000 lines here, against the repository's`,
          ),
        ]),
  );

const posture = ({
  strict,
  esm,
  complexity,
}: TerritoryTypeScriptView): HTMLElement =>
  h(
    "div",
    "ts-line",
    ...(strict === null ? [] : [line(h("b", "", strict))]),
    ...(esm === null ? [] : [line(h("b", "", esm), " ES modules")]),
    ...(complexity === null
      ? []
      : [
          line(
            h("b", "", complexity.share),
            ` of functions score 15+${complexity.counts === null ? "" : ` (${complexity.counts})`}, hardest `,
            h("b", "", complexity.max),
          ),
        ]),
  );

const imports = ({
  imports: counts,
  inCycle,
}: TerritoryTypeScriptView): HTMLElement =>
  h(
    "div",
    "ts-line",
    ...(counts === null
      ? []
      : [
          line("Imports ", h("b", "", counts.imports), " territories"),
          line("Imported by ", h("b", "", counts.importedBy), " territories"),
        ]),
    ...(inCycle
      ? [h("div", "cap sub", "A cycle of files runs through it.")]
      : []),
  );

/**
 * The TypeScript lines of a territory's stats panel: the size of its code and
 * its escape hatches per 1,000 lines against the repository's, the compiler
 * posture, module system and hard functions, and how it is imported. Facts only.
 */
export const typescriptItem = (view: TerritoryTypeScriptView): HTMLElement => {
  const element = item(
    "file-code",
    "TypeScript",
    h("div", "ts-lines", escapes(view), posture(view), imports(view)),
  );
  element.classList.add("ts-item");
  return element;
};
