import { importFilesView } from "../present/typescript-import-files.js";
import type {
  CycleRow,
  FileCountRow,
} from "../present/typescript-import-files.js";
import type { TypeScriptDeepDive } from "../present/typescript-summary.js";
import { card } from "./card.js";
import { commaList, h, mono } from "./dom.js";

type Imports = NonNullable<TypeScriptDeepDive["imports"]>;

const fileRow = ({
  name,
  path,
  count,
  fraction,
}: FileCountRow): HTMLElement => {
  const fill = h("i", "");
  fill.style.width = `${Math.max(fraction, 0.02) * 100}%`;
  return h(
    "div",
    "tl",
    mono(name, path),
    h("span", "bar", fill),
    h("b", "", count),
  );
};

const fileList = (title: string, rows: readonly FileCountRow[]): HTMLElement =>
  h(
    "div",
    "ts-col",
    h("div", "slabel", title),
    rows.length === 0
      ? h("p", "empty", "None.")
      : h("div", "toplist", ...rows.map((row) => fileRow(row))),
  );

const cycle = ({ title, files, more }: CycleRow): HTMLElement =>
  h(
    "div",
    "cycle",
    h("b", "", title),
    h(
      "div",
      "chips-line",
      ...files.map(({ name, path }) => mono(name, path)),
      ...(more === null ? [] : [h("span", "muted", more)]),
    ),
  );

/**
 * The file graph behind the territory map: its size, the files that the most
 * others import and that import the most, and the cycles. A cycle describes
 * the code and does not judge it, and type-only imports are told apart.
 */
export const fileGraphCard = (imports: Imports): HTMLElement => {
  const view = importFilesView(imports);
  return card(
    "File graph",
    "Imports between production files; test files are not part of fan-in, fan-out or cycles",
    h(
      "div",
      "ts-facts",
      ...view.facts.map(({ value, label }) =>
        h("div", "", h("b", "", value), h("span", "", label)),
      ),
    ),
    h(
      "div",
      "ts-cols",
      fileList("Most imported files", view.fanIn),
      fileList("Importing the most files", view.fanOut),
    ),
    h("p", "ts-lead", view.cycleSummary),
    ...view.cycles.map((entry) => cycle(entry)),
    ...(view.unresolvedSummary === null
      ? []
      : [
          h(
            "p",
            "note",
            `${view.unresolvedSummary} Most named: `,
            ...commaList(
              view.unresolved.map(({ specifier }) => mono(specifier)),
            ),
            ".",
          ),
        ]),
  );
};
